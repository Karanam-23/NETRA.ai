import time
import uuid
import logging
import multiprocessing
from typing import Dict, List
from firebase_admin import firestore

from pipeline.ingestion.frame_buffer import FrameBuffer
from pipeline.ai.models import ThreatDetectorSingleton, Detection
from pipeline.ai.tracker import TrackerRegistry
from pipeline.ai.heuristics import FallDetector, RestrictedZoneDetector, ThreatEvent
from pipeline.ai.classifier import BehaviorClassifier

# We import the functions we built in earlier steps
from services.rtdb import trigger_live_alert
from services.storage import upload_evidence

# from workers.tasks import dispatch_alert_tasks  (Future Celery hook for Twilio/Clips)

logger = logging.getLogger(__name__)

class CameraOrchestrator:
    def __init__(self, org_id: str, camera_id: str, redis_url: str = "redis://localhost:6379/0"):
        self.org_id = org_id
        self.camera_id = camera_id
        self.buffer = FrameBuffer(redis_url=redis_url, max_depth=30)
        self.db = firestore.client()
        
        # Initialize isolated AI components
        self.detector = ThreatDetectorSingleton()
        self.tracker_registry = TrackerRegistry()
        self.lstm_classifier = BehaviorClassifier()
        self.fall_detector = FallDetector(fps=5)
        self.zone_detector = RestrictedZoneDetector(zones_config=[])
        
        # State tracking (50 frames ensures we have enough buffer for heuristics)
        self.track_history: Dict[int, List[Detection]] = {}
        self.history_max_len = 50
        
        # Deduplication state: (track_id, threat_type) -> last_triggered_time
        self.alert_cooldowns: Dict[tuple, float] = {}
        self.cooldown_period = 30.0  # Configure to 30s per PRD
        
        # Zone config refresh state
        self.last_zone_refresh = 0.0
        self.zone_refresh_interval = 300.0  # 5 minutes
        
    def _refresh_zones(self):
        """Loads restricted zones for this camera from Firestore every 5 minutes."""
        now = time.time()
        if (now - self.last_zone_refresh) < self.zone_refresh_interval and self.last_zone_refresh != 0:
            return
            
        logger.info(f"[{self.camera_id}] Refreshing zone configurations from Firestore...")
        zones_ref = self.db.collection(f'zones/{self.org_id}')
        query = zones_ref.where('cameraId', '==', self.camera_id).stream()
        
        config = [doc.to_dict() for doc in query]
            
        self.zone_detector = RestrictedZoneDetector(zones_config=config)
        self.last_zone_refresh = now

    def _update_track_history(self, current_detections: List[Detection]):
        """Maintains the rolling 50-frame history per track_id."""
        current_track_ids = set()
        
        for det in current_detections:
            if det.track_id is None:
                continue
                
            current_track_ids.add(det.track_id)
            if det.track_id not in self.track_history:
                self.track_history[det.track_id] = []
                
            self.track_history[det.track_id].append(det)
            
            # Cap history array
            if len(self.track_history[det.track_id]) > self.history_max_len:
                self.track_history[det.track_id].pop(0)

        # Cleanup tracks no longer seen to prevent memory bloat over weeks of uptime
        stale_tracks = [tid for tid in self.track_history.keys() if tid not in current_track_ids]
        for tid in stale_tracks:
            # We keep them around momentarily for robustness against occlusion.
            # ByteTrack re-assigns them if they reappear shortly.
            # Clean up aggressively only if they vanish for good (done in a GC pass ideally).
            pass

    def _handle_threat(self, event: ThreatEvent, frame_bytes: bytes):
        """Deduplicates, persists to Firestore/Storage, and dispatches real-time alerts."""
        now = time.time()
        cooldown_key = (event.track_id, event.threat_type)
        
        # 1. Deduplication
        if cooldown_key in self.alert_cooldowns:
            if (now - self.alert_cooldowns[cooldown_key]) < self.cooldown_period:
                return # Suppress duplicate
                
        self.alert_cooldowns[cooldown_key] = now
        logger.warning(f"[{self.camera_id}] THREAT DETECTED: {event.threat_type} (Track {event.track_id}, Conf: {event.confidence})")
        
        incident_id = f"inc_{uuid.uuid4().hex[:8]}"
        
        # 2. Save Snapshot locally temporarily
        temp_snap_path = f"/tmp/{incident_id}.jpg"
        with open(temp_snap_path, "wb") as f:
            f.write(frame_bytes)
            
        # 3. Upload Snapshot to Firebase Storage (from Step 3)
        snapshot_url = upload_evidence(self.org_id, incident_id, temp_snap_path, "snapshot")
        
        # Fetch camera name formatting purposes
        cam_doc = self.db.collection(f'cameras/{self.org_id}').document(self.camera_id).get()
        camera_name = cam_doc.to_dict().get('name', 'Camera') if cam_doc.exists else 'Camera'
        
        # 4. Write Incident to Firestore (from Step 1)
        incident_data = {
            "cameraId": self.camera_id,
            "threatType": event.threat_type,
            "confidence": event.confidence,
            "status": "alerted",
            "detectedAt": firestore.SERVER_TIMESTAMP,
            "acknowledgedAt": None,
            "resolvedAt": None,
            "resolvedBy": None,
            "snapshotUrl": snapshot_url,
            "clipUrl": None, # Stitched asynchronously 10 seconds later
            "operatorNote": ""
        }
        self.db.collection(f'incidents/{self.org_id}').document(incident_id).set(incident_data)
        
        # 5. Push Live Alert to Realtime Database (from Step 2)
        trigger_live_alert(
            org_id=self.org_id,
            incident_id=incident_id,
            threat_type=event.threat_type,
            camera_name=camera_name,
            zone_name="Automated Zone",
            confidence=event.confidence,
            snapshot_url=snapshot_url
        )
        
        # 6. Dispatch Async Follow-ups via Celery (Twilio SMS / Clip extraction)
        # dispatch_alert_tasks.delay(self.org_id, incident_id, event.threat_type, camera_name)

    def run_loop(self):
        """The main continuous inference loop for this camera."""
        logger.info(f"[{self.camera_id}] Starting AI Orchestrator loop...")
        
        while True:
            try:
                self._refresh_zones()
                
                # Pop oldest frame from the REDIS queue
                item = self.buffer.pop_frame(self.org_id, self.camera_id)
                if not item:
                    time.sleep(0.01) # Yield to CPU if queue is empty
                    continue
                    
                frame_bytes = item['frame_bytes']
                frame_h = item['metadata']['resolution_h']
                frame_w = item['metadata']['resolution_w']
                
                # ---------------- PIPELINE EXECUTION ----------------
                
                # Phase 1: Pose Inference
                detections = self.detector.run_inference(frame_bytes)
                
                # Phase 2: Frame-to-Frame Target Tracking
                tracked_detections = self.tracker_registry.update_tracks(self.camera_id, detections, (frame_h, frame_w))
                self._update_track_history(tracked_detections)
                
                # Phase 3: Logic Heuristics
                all_threats = []
                all_threats.extend(self.fall_detector.evaluate(self.track_history, tracked_detections, self.camera_id, frame_h))
                all_threats.extend(self.zone_detector.evaluate(self.track_history, tracked_detections, self.camera_id))
                
                # Phase 4: LSTM Classification
                all_threats.extend(self.lstm_classifier.evaluate(tracked_detections, self.camera_id))
                
                # Phase 5: Threat Dispatch
                for event in all_threats:
                    self._handle_threat(event, frame_bytes)
                    
            except Exception as e:
                logger.error(f"[{self.camera_id}] Orchestrator loop crashed: {str(e)}. Restarting in 1s...", exc_info=True)
                time.sleep(1)

def orchestrator_process(org_id: str, camera_id: str):
    """Entry point for the multiprocessing.Process"""
    orchestrator = CameraOrchestrator(org_id, camera_id)
    orchestrator.run_loop()

def spawn_pipeline_for_camera(org_id: str, camera_id: str, rtsp_url: str):
    """
    Spawns BOTH the ingestion layer and the AI orchestrator as separate processes.
    Call this from your main FastAPI server when a camera is registered or system boots.
    """
    from pipeline.ingestion.rtsp_reader import spawn_camera_process
    
    # 1. Start OpenCV RTSP Ingestion Process
    reader_p = spawn_camera_process(org_id, camera_id, rtsp_url)
    
    # 2. Start YOLO/LSTM Inference Process
    ai_p = multiprocessing.Process(
        target=orchestrator_process,
        args=(org_id, camera_id),
        daemon=True
    )
    ai_p.start()
    
    logger.info(f"[{camera_id}] Spawned Pipeline: Ingestion PID={reader_p.pid}, AI PID={ai_p.pid}")
    return reader_p, ai_p
