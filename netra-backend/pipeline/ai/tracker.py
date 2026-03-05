import torch
import numpy as np
from typing import List, Dict
from types import SimpleNamespace
from pipeline.ai.models import Detection

# Ultralytics natively ships with a fast BYTETracker implementation
from ultralytics.trackers.byte_tracker import BYTETracker

def calculate_iou(box1: List[float], box2: List[float]) -> float:
    """Calculates Intersection over Union (IoU) between two bounding boxes."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    return intersection / float(area1 + area2 - intersection + 1e-6)

class TrackerRegistry:
    def __init__(self):
        self._trackers: Dict[str, BYTETracker] = {}
        
    def get_tracker(self, camera_id: str) -> BYTETracker:
        """Returns the ByteTracker instance for a camera, creating it if necessary."""
        if camera_id not in self._trackers:
            # Configure tracking hyperparameters securely
            args = SimpleNamespace(
                track_high_thresh=0.5,
                track_low_thresh=0.1,
                new_track_thresh=0.6,
                track_buffer=10,  # 10 frames = 2 seconds at 5 FPS before ID expiry
                match_thresh=0.8,
                gsi=False,
                mot20=False
            )
            self._trackers[camera_id] = BYTETracker(args, frame_rate=5)
        return self._trackers[camera_id]
        
    def update_tracks(self, camera_id: str, detections: List[Detection], img_shape: tuple) -> List[Detection]:
        """
        Feeds fresh detections into ByteTrack. 
        Returns the same Detection objects, but with 'track_id' populated.
        """
        tracker = self.get_tracker(camera_id)
        
        if not detections:
            # Step the tracker forward temporally even if no detections are present
            tracker.update(torch.empty((0, 5)), img_shape)
            return []
            
        # Format for Ultralytics ByteTracker update(): [x1, y1, x2, y2, confidence, class]
        dets_array = []
        for det in detections:
            dets_array.append([det.bbox[0], det.bbox[1], det.bbox[2], det.bbox[3], det.confidence, 0.0])
            
        dets_tensor = torch.tensor(dets_array, dtype=torch.float32)
        
        # ByteTracker doesn't need actual pixel data, just a dummy image tensor of correct shape
        dummy_img = torch.zeros((img_shape[0], img_shape[1], 3)) 
        
        # 'tracks' is a list of STrack objects containing updated boxes and track_ids
        tracks = tracker.update(dets_tensor, dummy_img)
        
        assigned_detections = []
        
        # Re-attach track IDs to our rich Detection objects (which contain pose keypoints)
        # We match them up using IoU because ByteTrack might slightly smooth/shift the box
        for track in tracks:
            track_bbox = track.tlbr  # top-left bottom-right
            best_iou = 0
            best_det = None
            
            for det in detections:
                iou = calculate_iou(track_bbox, det.bbox)
                if iou > best_iou:
                    best_iou = iou
                    best_det = det
            
            # If matched successfully, pair the original detection data with the persistent Track ID
            if best_det and best_iou > 0.5:
                assigned_detections.append(
                    Detection(
                        bbox=best_det.bbox,
                        keypoints=best_det.keypoints,
                        confidence=best_det.confidence,
                        track_id=track.track_id
                    )
                )
                
        return assigned_detections
