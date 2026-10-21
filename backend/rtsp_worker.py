"""
CrowdFlow RTSP and Video Stream Worker
Background worker that processes RTSP streams or local video files via OpenCV VideoCapture,
sampling frames at a controlled rate and feeding them into the people detector.
"""

import time
import threading
import cv2
from typing import Dict, Optional, Callable
from database import add_event_log

class StreamProcessorThread(threading.Thread):
    def __init__(
        self,
        camera_id: str,
        stream_source: str, # RTSP URL or local video file path
        is_video_file: bool,
        detector_fn: Callable, # fn(img_bgr, camera_id) -> result dict
        on_detection_callback: Callable, # fn(camera_id, result) -> None
        sample_interval: float = 0.5, # 2 fps default
        loop_video: bool = True
    ):
        super().__init__(daemon=True, name=f"StreamWorker-{camera_id}")
        self.camera_id = camera_id
        self.stream_source = stream_source
        self.is_video_file = is_video_file
        self.detector_fn = detector_fn
        self.on_detection_callback = on_detection_callback
        self.sample_interval = sample_interval
        self.loop_video = loop_video
        self.running = False
        self._stop_event = threading.Event()

    def run(self):
        self.running = True
        print(f"🎬 Starting stream processor for camera {self.camera_id} (source: {self.stream_source})")

        while not self._stop_event.is_set():
            cap = None
            try:
                cap = cv2.VideoCapture(self.stream_source)
                if not cap.isOpened():
                    print(f"⚠️ Could not open stream source for camera {self.camera_id}")
                    add_event_log(
                        "CAMERA_ERROR",
                        f"Stream source unreachable for camera '{self.camera_id}'. Retrying in 5s.",
                        severity="warning",
                        camera_id=self.camera_id
                    )
                    time.sleep(5.0)
                    continue

                last_sample_time = 0.0

                while not self._stop_event.is_set():
                    ret, frame = cap.read()
                    if not ret:
                        if self.is_video_file and self.loop_video:
                            # Loop video back to beginning
                            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                            continue
                        else:
                            print(f"Stream ended or frame drop on camera {self.camera_id}")
                            break

                    now = time.time()
                    if now - last_sample_time >= self.sample_interval:
                        last_sample_time = now
                        # Process frame through people detector
                        try:
                            # Optional resize for inference speed
                            h, w = frame.shape[:2]
                            if w > 1280:
                                scale = 1280 / w
                                frame_resized = cv2.resize(frame, (1280, int(h * scale)))
                            else:
                                frame_resized = frame

                            res = self.detector_fn(frame_resized, self.camera_id)
                            try:
                                import base64
                                tw = 400
                                th = max(10, int(tw * h / (w or 1)))
                                small_frame = cv2.resize(frame_resized, (tw, th))
                                for b in res.get('boxes', []):
                                    bx1 = int(b['x1'] * tw / (w or 1))
                                    by1 = int(b['y1'] * th / (h or 1))
                                    bx2 = int(b['x2'] * tw / (w or 1))
                                    by2 = int(b['y2'] * th / (h or 1))
                                    cv2.rectangle(small_frame, (bx1, by1), (bx2, by2), (0, 255, 0), 2)
                                _, buffer = cv2.imencode('.jpg', small_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                                res['thumbnail_b64'] = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('ascii')}"
                            except Exception:
                                pass
                            self.on_detection_callback(self.camera_id, res)
                        except Exception as det_err:
                            print(f"Error in detection callback for camera {self.camera_id}: {det_err}")

                    time.sleep(0.01) # Yield CPU

            except Exception as e:
                print(f"Stream error on camera {self.camera_id}: {e}")
                time.sleep(3.0)
            finally:
                if cap:
                    cap.release()

        self.running = False
        print(f"⏹️ Stopped stream processor for camera {self.camera_id}")

    def stop(self):
        self._stop_event.set()

class StreamManager:
    def __init__(self, detector):
        self.detector = detector
        self.workers: Dict[str, StreamProcessorThread] = {}
        self.broadcast_callback = None

    def set_broadcast_callback(self, cb: Callable):
        self.broadcast_callback = cb

    def start_camera_stream(self, camera_id: str, source: str, is_video: bool = False, loop: bool = True):
        self.stop_camera_stream(camera_id)

        def on_detection(cam_id, res):
            if self.broadcast_callback:
                self.broadcast_callback(cam_id, res)

        worker = StreamProcessorThread(
            camera_id=camera_id,
            stream_source=source,
            is_video_file=is_video,
            detector_fn=self.detector.detect_and_count,
            on_detection_callback=on_detection,
            sample_interval=0.5,
            loop_video=loop
        )
        self.workers[camera_id] = worker
        worker.start()

    def stop_camera_stream(self, camera_id: str):
        if camera_id in self.workers:
            self.workers[camera_id].stop()
            del self.workers[camera_id]

    def stop_all(self):
        for cid in list(self.workers.keys()):
            self.stop_camera_stream(cid)
