import os
import cv2
import json
import uuid
import struct
from firebase_admin import firestore

# Import the standalone services
from services.twilio_client import send_sms
from services.mqtt_client import trigger_alarm
from services.storage import upload_evidence

# Import our Celery app and RTDB cleanup code
from workers.celery_app import celery_app
from workers.rtbd_cleanup import cleanup_stale_alerts 

@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    # Register the RTDB cleanup task to run every 60 seconds
    sender.add_periodic_task(60.0, cleanup_stale_alerts.s(), name='cleanup_rtbd_every_minute')

@celery_app.task
def dispatch_alert_tasks(org_id: str, incident_id: str, threat_type: str, camera_id: str, camera_name: str, zone_name: str, confidence: float):
    """
    Main fan-out task. 
    1. Fetches responders.
    2. Sends SMS.
    3. Triggers Hardware Alarms.
    4. Schedules the clip extraction 10 seconds into the future.
    """
    db = firestore.client()
    
    # Send SMS to the configured recipient number from .env
    from services.twilio_client import TWILIO_TO_NUMBER
    
    if TWILIO_TO_NUMBER:
        timestamp_str = "just now"
        front_end_url = os.getenv('FRONTEND_URL', 'https://app.netra.ai')
        
        message = (
            f"[NETRA.AI ALERT] {threat_type} detected at {camera_name} ({zone_name}).\n"
            f"Confidence: {int(confidence * 100)}%. Time: {timestamp_str}.\n"
            f"View incident: {front_end_url}/incidents/{org_id}/{incident_id}"
        )
        send_sms_alert.delay([TWILIO_TO_NUMBER], message)
        
    # 3. Trigger MQTT Hardware Relays
    trigger_alarm(org_id, camera_id)
    
    # 4. Schedule Video Clip extraction exactly 10 seconds from now
    extract_and_upload_clip.apply_async(
        args=[org_id, incident_id, camera_id], 
        countdown=10
    )


@celery_app.task
def send_sms_alert(phone_numbers: list, message: str):
    """Loops over destination numbers and sends the Twilio SMS."""
    success_count = 0
    for phone in phone_numbers:
        # We don't want one invalid number to crash the whole loop
        success = send_sms(to=phone, body=message)
        if success:
            success_count += 1
            
    return f"Sent SMS to {success_count}/{len(phone_numbers)} responders."


@celery_app.task
def extract_and_upload_clip(org_id: str, incident_id: str, camera_id: str):
    """
    Stitches the last 50 frames from Redis into an MP4 and uploads it to Firebase Storage.
    """
    import redis
    r = redis.Redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
    
    key = f"frames:{org_id}:{camera_id}"
    
    # Fetch the entire frame buffer natively
    # (Since we capped it at 30/50 in ingestion, grabbing the whole list is safe)
    items = r.lrange(key, 0, -1)
    
    if not items:
        return "No frames found in Redis buffer. Clip generation failed."
        
    # Frames in Redis are L-pushed, so the list is technically [newest, ..., oldest]
    # We must reverse it for chronologically correct video playback
    items.reverse()
    
    temp_clip_path = f"/tmp/{uuid.uuid4().hex}_clip.mp4"
    video_writer = None
    
    try:
        for idx, item in enumerate(items):
            # Same parsing logic as FrameBuffer.pop_frame
            meta_len, = struct.unpack(">I", item[:4])
            jpeg_bytes = item[4+meta_len:]
            
            # Reconstruct image
            import numpy as np
            nparr = np.frombuffer(jpeg_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Initialize VideoWriter on the first frame using its resolution
            if video_writer is None:
                h, w, _ = frame.shape
                # MP4V codec is widely supported for .mp4 containers
                fourcc = cv2.VideoWriter_fourcc(*'mp4v') 
                video_writer = cv2.VideoWriter(temp_clip_path, fourcc, 5.0, (w, h))
                
            video_writer.write(frame)
            
    finally:
        if video_writer:
            video_writer.release()
            
    # Upload Evidence and get the signed URL (Using the function built in Step 3)
    signed_clip_url = upload_evidence(org_id, incident_id, temp_clip_path, "clip")
    
    # Clean up local temp file
    if os.path.exists(temp_clip_path):
        os.remove(temp_clip_path)
        
    # Finally, link the clip to the Firestore Incident record
    db = firestore.client()
    db.collection(f'incidents/{org_id}').document(incident_id).update({
        "clipUrl": signed_clip_url
    })
    
    return f"Clip uploaded successfully for incident {incident_id}"
