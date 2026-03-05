import cv2
import time
import logging
import multiprocessing
from firebase_admin import firestore
from pipeline.ingestion.frame_buffer import FrameBuffer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_camera_status(org_id: str, camera_id: str, status: str):
    """Updates the camera status in Firestore."""
    try:
        db = firestore.client()
        db.collection(f'cameras/{org_id}').document(camera_id).update({"status": status})
        logger.info(f"[{camera_id}] Status updated to: {status}")
    except Exception as e:
        logger.error(f"[{camera_id}] Failed to update status in Firestore: {e}")

def camera_reader_process(org_id: str, camera_id: str, rtsp_url: str, fps_cap: int = 5, redis_url: str = "redis://localhost:6379/0"):
    """
    Dedicated process for reading RTSP stream, downsampling FPS, and pushing JPEG frames to Redis.
    """
    buffer = FrameBuffer(redis_url=redis_url, max_depth=30)
    
    max_retries = 5
    retry_count = 0
    base_backoff = 2  # seconds
    frame_interval = 1.0 / fps_cap
    
    while retry_count <= max_retries:
        logger.info(f"[{camera_id}] Connecting to RTSP stream (Attempt {retry_count + 1})...")
        update_camera_status(org_id, camera_id, "live")
        
        # Open stream and minimize OpenCV internal buffering to reduce latency
        cap = cv2.VideoCapture(rtsp_url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        last_frame_time = 0
        stream_active = False
        
        if cap.isOpened():
            stream_active = True
            retry_count = 0  # Reset retries on successful connection
            logger.info(f"[{camera_id}] Stream connected successfully.")
            
        while stream_active:
            ret, frame = cap.read()
            if not ret:
                logger.warning(f"[{camera_id}] Failed to grab frame. Stream might have dropped.")
                stream_active = False
                break
                
            current_time = time.time()
            # Enforce FPS Cap
            if (current_time - last_frame_time) >= frame_interval:
                # 1. Encode raw numpy frame into JPEG bytes
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 80]
                _, buffer_img = cv2.imencode('.jpg', frame, encode_param)
                jpeg_bytes = buffer_img.tobytes()
                
                # 2. Attach metadata
                metadata = {
                    "timestamp": current_time,
                    "resolution_w": frame.shape[1],
                    "resolution_h": frame.shape[0],
                    "org_id": org_id,
                    "camera_id": camera_id
                }
                
                # 3. Push to Redis queue
                buffer.push_frame(org_id, camera_id, jpeg_bytes, metadata)
                last_frame_time = current_time
                
        cap.release()
        
        # Exponential backoff on failure
        retry_count += 1
        if retry_count <= max_retries:
            sleep_time = base_backoff ** retry_count
            logger.warning(f"[{camera_id}] Retrying in {sleep_time} seconds...")
            update_camera_status(org_id, camera_id, "degraded")
            time.sleep(sleep_time)
            
    # Mark offline if all retries exhausted
    logger.error(f"[{camera_id}] Max retries ({max_retries}) exhausted. Marking offline.")
    update_camera_status(org_id, camera_id, "offline")

def spawn_camera_process(org_id: str, camera_id: str, rtsp_url: str) -> multiprocessing.Process:
    """Helper to start the ingestion process from the main orchestrator."""
    p = multiprocessing.Process(
        target=camera_reader_process,
        args=(org_id, camera_id, rtsp_url),
        daemon=True  # Kill automatically if the parent API dies
    )
    p.start()
    return p
