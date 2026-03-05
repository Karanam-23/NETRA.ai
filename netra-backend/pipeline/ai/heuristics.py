from dataclasses import dataclass
from typing import List, Dict, Any
import datetime
import pytz
import cv2
import numpy as np

from pipeline.ai.models import Detection

@dataclass
class ThreatEvent:
    threat_type: str
    track_id: int
    camera_id: str
    confidence: float
    bbox: List[float]

class FallDetector:
    def __init__(self, fps: int = 5):
        self.fps = fps
        self.drop_time_frames = int(1.0 * fps)     # Y drop must occur in ~1 second (5 frames)
        self.still_time_frames = int(1.5 * fps)    # Person remains still for 1.5 seconds (7-8 frames)
        self.required_history = self.drop_time_frames + self.still_time_frames

    def evaluate(self, track_history: Dict[int, List[Detection]], current_detections: List[Detection], camera_id: str, frame_height: int) -> List[ThreatEvent]:
        """Analyzes historical keypoint trajectories to detect rapid drops and stillness."""
        events = []
        for det in current_detections:
            if not det.track_id:
                continue
                
            history = track_history.get(det.track_id, [])
            if len(history) < self.required_history:
                continue
                
            # Grab the last N frames to analyze the motion window
            recent_history = history[-self.required_history:]
            
            def get_y_coord(d: Detection) -> float:
                """Gets hip Y-coord (Coco indices 11,12) or falls back to bbox bottom edge."""
                if d.keypoints and len(d.keypoints) > 12:
                    y11 = d.keypoints[11][1]
                    y12 = d.keypoints[12][1]
                    return (y11 + y12) / 2.0
                return d.bbox[3]
                
            y_coords = [get_y_coord(d) for d in recent_history]
            
            # A fall is an increase in Y coordinate (top-left is 0,0 in OpenCV)
            start_y = y_coords[0]
            drop_y = y_coords[self.drop_time_frames]
            drop_distance = drop_y - start_y
            
            # Condition 1: Y coordinate drops rapidly (> 40% of frame height)
            if drop_distance > (frame_height * 0.40):
                post_drop_y_coords = y_coords[self.drop_time_frames:]
                
                # Condition 2: They remain laying low and relatively still
                if (max(post_drop_y_coords) - min(post_drop_y_coords)) < (frame_height * 0.10):
                    events.append(ThreatEvent(
                        threat_type="Sudden Fall",
                        track_id=det.track_id,
                        camera_id=camera_id,
                        confidence=0.85,
                        bbox=det.bbox
                    ))
        return events

class RestrictedZoneDetector:
    def __init__(self, zones_config: List[Dict]):
        """
        zones_config expects format matching Firestore:
        [{"name": "Zone A", "coordinates": [{"x":...,"y":...}], "activeHours": {"start": "22:00", "end": "06:00"}}]
        """
        self.zones = zones_config
        self.ist_tz = pytz.timezone('Asia/Kolkata')
        
    def evaluate(self, track_history: Dict[int, List[Detection]], current_detections: List[Detection], camera_id: str) -> List[ThreatEvent]:
        """Checks if a person's center point has entered an active polygon threshold."""
        events = []
        now_ist = datetime.datetime.now(self.ist_tz)
        current_time_str = now_ist.strftime("%H:%M")
        
        for det in current_detections:
            if not det.track_id: 
                continue
            
            # Center point of the bounding box
            cx = (det.bbox[0] + det.bbox[2]) / 2.0
            cy = (det.bbox[1] + det.bbox[3]) / 2.0
            point = (float(cx), float(cy))
            
            for zone in self.zones:
                start_h = zone['activeHours']['start']
                end_h = zone['activeHours']['end']
                
                # Time window logic (handles overnight safely)
                is_active = False
                if start_h <= end_h:
                    is_active = start_h <= current_time_str <= end_h
                else:
                    is_active = current_time_str >= start_h or current_time_str <= end_h
                    
                if not is_active:
                    continue
                    
                pts = np.array([[pt['x'], pt['y']] for pt in zone['coordinates']], np.int32).reshape((-1, 1, 2))
                
                # OpenCV pointPolygonTest (Returns measure of distance from boundary. >0 means inside)
                dist = cv2.pointPolygonTest(pts, point, measureDist=True)
                
                if dist >= 0:
                    # Logic: 70% confidence for touching boundary, scaling up to 100% deeper inside
                    confidence = min(1.0, 0.70 + (dist / 100.0) * 0.30)
                    
                    events.append(ThreatEvent(
                        threat_type="RestrictedZone",
                        track_id=det.track_id,
                        camera_id=camera_id,
                        confidence=round(confidence, 2),
                        bbox=det.bbox
                    ))
                    break # Once detected in one zone, stop processing this person
        return events
