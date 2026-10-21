"""
CrowdFlow Real-Time People Detection Pipeline
Modular detector interface supporting Ultralytics YOLOv8n with temporal smoothing and real bounding box extraction.
"""

import time
import base64
import os
import cv2
import numpy as np
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Tuple, Optional

class BasePeopleDetector(ABC):
    @abstractmethod
    def detect_and_count(self, image_bgr: np.ndarray, camera_id: str = "default") -> Dict[str, Any]:
        """Process image frame and return count, confidence, and bounding boxes."""
        pass

class YoloPeopleDetector(BasePeopleDetector):
    def __init__(self, model_name: str = "yolov8n.pt", conf_threshold: float = 0.35, ema_alpha: float = 0.25):
        self.conf_threshold = conf_threshold
        self.ema_alpha = ema_alpha
        self.smoothed_counts: Dict[str, float] = {}
        self.model_name = model_name
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            from ultralytics import YOLO
            # Find or download weights
            weights_path = os.path.join(os.path.dirname(__file__), 'models', self.model_name)
            if not os.path.exists(weights_path) and os.path.exists(self.model_name):
                weights_path = self.model_name
            self.model = YOLO(weights_path if os.path.exists(weights_path) else self.model_name)
            print(f"✅ YOLO detector successfully initialized with {self.model_name}")
        except Exception as e:
            print(f"❌ Failed to load YOLO model: {e}")
            raise RuntimeError(f"YOLO detector initialization failed: {e}")

    def detect_and_count(self, image_bgr: np.ndarray, camera_id: str = "default") -> Dict[str, Any]:
        if self.model is None:
            raise RuntimeError("YOLO model is not initialized.")

        t_start = time.perf_counter()
        h, w = image_bgr.shape[:2]

        # Run inference filtering specifically for class 0 (person in COCO)
        results = self.model(image_bgr, classes=[0], conf=self.conf_threshold, verbose=False)
        t_infer = (time.perf_counter() - t_start) * 1000.0

        boxes_out = []
        confidences = []

        if results and len(results) > 0:
            boxes = results[0].boxes
            if boxes is not None:
                for b in boxes:
                    # b.xyxy contains [x1, y1, x2, y2]
                    xyxy = b.xyxy[0].cpu().numpy().tolist()
                    conf = float(b.conf[0].cpu().numpy())
                    boxes_out.append({
                        "x1": round(xyxy[0], 1),
                        "y1": round(xyxy[1], 1),
                        "x2": round(xyxy[2], 1),
                        "y2": round(xyxy[3], 1),
                        "conf": round(conf, 2)
                    })
                    confidences.append(conf)

        raw_count = len(boxes_out)
        avg_conf = float(np.mean(confidences)) if confidences else (1.0 if raw_count == 0 else 0.0)

        # Apply Exponential Moving Average (EMA) temporal smoothing per camera
        prev_smoothed = self.smoothed_counts.get(camera_id, float(raw_count))
        smoothed = (1.0 - self.ema_alpha) * prev_smoothed + self.ema_alpha * float(raw_count)
        self.smoothed_counts[camera_id] = smoothed

        people_count = int(round(smoothed))

        return {
            "people_count": people_count,
            "raw_count": raw_count,
            "smoothed_value": round(smoothed, 2),
            "confidence": round(avg_conf, 2),
            "boxes": boxes_out,
            "image_width": w,
            "image_height": h,
            "inference_ms": round(t_infer, 1),
            "timestamp": time.time(),
            "model": "YOLOv8n"
        }

def decode_image_from_bytes(data: bytes) -> Optional[np.ndarray]:
    """Decode JPEG/PNG bytes to BGR numpy array."""
    np_arr = np.frombuffer(data, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

def decode_image_from_base64(b64_string: str) -> Optional[np.ndarray]:
    """Decode data-URI or raw base64 string to BGR numpy array."""
    if ',' in b64_string:
        b64_string = b64_string.split(',', 1)[1]
    raw_bytes = base64.b64decode(b64_string)
    return decode_image_from_bytes(raw_bytes)
