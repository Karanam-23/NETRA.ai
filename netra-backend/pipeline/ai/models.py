import time
import logging
from typing import List, Optional
from pydantic import BaseModel
import numpy as np
import cv2
from ultralytics import YOLO

logger = logging.getLogger(__name__)

# Core data schema that passes from YOLO -> ByteTrack -> LSTM
class Detection(BaseModel):
    bbox: List[float]                             # [x1, y1, x2, y2]
    keypoints: Optional[List[List[float]]] = None # [[x, y, conf], ...] for 17 pose points
    confidence: float
    track_id: Optional[int] = None                # Filled in later by ByteTrack

class ThreatDetectorSingleton:
    """Singleton wrapper for the AI Inference Engine."""
    _instance = None
    
    def __new__(cls, model_path="yolov8n-pose.onnx"):
        if cls._instance is None:
            cls._instance = super(ThreatDetectorSingleton, cls).__new__(cls)
            cls._instance._initialize(model_path)
        return cls._instance
        
    def _initialize(self, model_path: str):
        logger.info(f"Loading YOLOv8 Pose model from {model_path}...")
        
        # Ultralytics natively delegates to ONNXRuntime if the model ends in .onnx
        # It will automatically invoke GPU acceleration if CUDA/TensorRT is available, 
        # and fallback safely to CPU if not.
        self.model = YOLO(model_path, task='pose')
        logger.info("Pose Inference Model Initialized successfully.")

    def run_inference(self, frame_bytes: bytes) -> List[Detection]:
        """
        Executes real-time pose estimation on raw JPEG bytes.
        Returns a structured list of bounding boxes and pose keypoints.
        """
        start_time = time.time()
        
        # Re-inflate JPEG bytes back to a numpy array for inference
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            logger.error("Failed to decode frame_bytes in run_inference.")
            return []
            
        # Run inference: class [0] strictly filters for 'person'
        # verbose=False prevents the console from filling up with frame metrics
        results = self.model(frame, classes=[0], verbose=False)
        
        detections = []
        if len(results) > 0:
            result = results[0]
            boxes = result.boxes
            keypoints = result.keypoints
            
            for i in range(len(boxes)):
                # Bounding box coordinates [x1, y1, x2, y2]
                box = boxes[i].xyxy[0].cpu().numpy().tolist()
                conf = float(boxes[i].conf[0].cpu().numpy())
                
                # Extract the 17 pose keypoints if the model identified them
                kpts_list = None
                if keypoints is not None and keypoints.has_visible:
                    # Shape is typically (Num_Persons, 17, 3), pull the current person 'i'
                    kpts = keypoints.data[i].cpu().numpy()
                    kpts_list = kpts.tolist()
                
                detections.append(Detection(
                    bbox=box,
                    keypoints=kpts_list,
                    confidence=conf,
                    track_id=None # Defaulting to None; ByteTrack handles this in the next step
                ))
                
        # Calculate and log latency 
        latency_ms = (time.time() - start_time) * 1000
        logger.debug(f"Inference Time: {latency_ms:.2f}ms | Persons Found: {len(detections)}")
        
        return detections
