import os
import logging
import numpy as np
from typing import List, Dict, Optional
import onnxruntime as ort

from pipeline.ai.models import Detection
from pipeline.ai.heuristics import ThreatEvent

logger = logging.getLogger(__name__)

class SequenceBuilder:
    """Maintains a rolling buffer of normalized keypoints per track_id."""
    def __init__(self, sequence_length: int = 30):
        self.sequence_length = sequence_length
        self.buffers: Dict[int, List[List[float]]] = {}
    
    def _normalize_keypoints(self, det: Detection) -> List[float]:
        """
        Normalizes 17 COCO keypoints (x, y) relative to the bounding box center.
        Ensures the LSTM is position and scale invariant.
        """
        if not det.keypoints:
            return [0.0] * 34  # 17 keypoints * 2 coordinates (x, y)
            
        # bbox is [x1, y1, x2, y2]
        cx = (det.bbox[0] + det.bbox[2]) / 2.0
        cy = (det.bbox[1] + det.bbox[3]) / 2.0
        width = max(det.bbox[2] - det.bbox[0], 1.0)
        height = max(det.bbox[3] - det.bbox[1], 1.0)
        
        normalized = []
        for kpt in det.keypoints:
            # kpt is [x, y, conf]; we only extract x, y and normalize them
            nx = (kpt[0] - cx) / width
            ny = (kpt[1] - cy) / height
            normalized.extend([nx, ny])
            
        return normalized

    def add_detection(self, det: Detection) -> Optional[np.ndarray]:
        """
        Adds a detection to the buffer.
        Returns a (1, sequence_length, 34) numpy array if the buffer is full, else None.
        """
        if det.track_id is None:
            return None
            
        norm_kpts = self._normalize_keypoints(det)
        
        if det.track_id not in self.buffers:
            self.buffers[det.track_id] = []
            
        self.buffers[det.track_id].append(norm_kpts)
        
        # Maintain sliding window of `sequence_length` frames
        if len(self.buffers[det.track_id]) > self.sequence_length:
            self.buffers[det.track_id].pop(0)
            
        if len(self.buffers[det.track_id]) == self.sequence_length:
            # Expand dims to match ONNX expected batch size of 1
            return np.array([self.buffers[det.track_id]], dtype=np.float32) 
            
        return None

    def remove_track(self, track_id: int):
        """Cleans up memory for lost tracks (called by orchestrator)."""
        if track_id in self.buffers:
            del self.buffers[track_id]

class BehaviorClassifier:
    def __init__(self, model_path: str = "models/behavior_lstm.onnx", threshold: float = 0.75):
        self.model_path = model_path
        self.threshold = threshold
        self.session = None
        self.classes = ["Neutral", "Struggling", "Chasing"]
        self.sequence_builder = SequenceBuilder(sequence_length=30)
        
        self._initialize_model()
        
    def _initialize_model(self):
        if not os.path.exists(self.model_path):
            logger.warning(f"LSTM model not found at {self.model_path}. Behavior classification gracefully disabled.")
            return
            
        try:
            # Load optimized ONNX session; gracefully fall back to CPU if TensorRT/CUDA fails
            providers = ['TensorrtExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider']
            self.session = ort.InferenceSession(self.model_path, providers=providers)
            self.input_name = self.session.get_inputs()[0].name
            logger.info("LSTM Behavior Classifier initialized.")
        except Exception as e:
            logger.error(f"Failed to load LSTM model: {e}")

    def evaluate(self, current_detections: List[Detection], camera_id: str) -> List[ThreatEvent]:
        """Evaluates ongoing behaviors for tracked persons."""
        events = []
        
        for det in current_detections:
            if not det.track_id:
                continue
                
            # Add detection to sequence builder
            seq_input = self.sequence_builder.add_detection(det)
            
            # If we don't have 30 frames yet, or the model isn't loaded, skip
            if seq_input is None or self.session is None:
                continue
                
            # Run inference
            outputs = self.session.run(None, {self.input_name: seq_input})
            probabilities = outputs[0][0] # Expected Output Shape: (3,)
            
            # Get max probability class
            class_idx = np.argmax(probabilities)
            confidence = float(probabilities[class_idx])
            predicted_class = self.classes[class_idx]
            
            if predicted_class in ["Struggling", "Chasing"] and confidence >= self.threshold:
                events.append(ThreatEvent(
                    threat_type=predicted_class,
                    track_id=det.track_id,
                    camera_id=camera_id,
                    confidence=round(confidence, 2),
                    bbox=det.bbox
                ))
                
        return events
