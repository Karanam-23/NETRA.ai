"""
Netra.AI Backend Scaffolder
Run once: python setup_project.py
Creates every folder and writes every file from Steps 6-8 into the correct paths.
"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))

FILES = {}

# ============================================================
# .env
# ============================================================
FILES[".env"] = """# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_DATABASE_URL=
FIREBASE_STORAGE_BUCKET=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Redis (Celery broker)
REDIS_URL=redis://localhost:6379/0

# App
API_BASE_URL=https://api.netra.ai
FRONTEND_URL=https://app.netra.ai
ALERT_ESCALATION_TIMEOUT_SECONDS=60
ALERT_DEDUP_WINDOW_SECONDS=30
DEFAULT_CONFIDENCE_THRESHOLD=0.75

# MQTT (Alarm Hardware)
MQTT_BROKER_HOST=
MQTT_BROKER_PORT=1883
MQTT_ALARM_TOPIC=netra/alarms/{orgId}/{cameraId}
"""

# ============================================================
# requirements.txt
# ============================================================
FILES["requirements.txt"] = """# --- FastAPI & Web Layer ---
fastapi==0.110.0
uvicorn[standard]==0.29.0
pydantic==2.6.3
pydantic-settings==2.2.1

# --- Firebase & GCP ---
firebase-admin==6.5.0

# --- Background Tasks & External Services ---
celery==5.3.6
redis==5.0.3
twilio==9.0.0
paho-mqtt==2.0.0

# --- Video Processing & Computer Vision ---
opencv-python-headless==4.9.0.80

# --- Machine Learning / AI Engine ---
ultralytics==8.1.24
onnxruntime-gpu==1.17.1
torch==2.2.1
torchvision==0.17.1
numpy==1.26.4
scipy==1.12.0
pytz==2024.1
"""

# ============================================================
# Firebase Rules
# ============================================================
FILES["firestore.rules"] = r"""rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }
    function isSuperAdmin() {
      return isAuthenticated() && request.auth.token.role == 'super_admin';
    }
    function isOrgMember(orgId) {
      return isAuthenticated() && request.auth.token.orgId == orgId;
    }
    function isOrgAdmin(orgId) {
      return isOrgMember(orgId) && request.auth.token.role == 'org_admin';
    }
    function isOperator(orgId) {
      return isOrgMember(orgId) && request.auth.token.role == 'operator';
    }

    match /{document=**} {
      allow read, write: if isSuperAdmin();
    }

    match /organizations/{orgId} {
      allow read: if isOrgMember(orgId);
      allow write: if isOrgAdmin(orgId);
    }

    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }

    match /cameras/{orgId}/{cameraId} {
      allow read: if isOrgMember(orgId);
      allow write: if isOrgAdmin(orgId);
      match /secrets/{secretDoc} {
        allow read, write: if false;
      }
    }

    match /zones/{orgId}/{zoneId} {
      allow read: if isOrgMember(orgId);
      allow write: if isOrgAdmin(orgId);
    }

    match /incidents/{orgId}/{incidentId} {
      allow read: if isOrgMember(orgId);
      allow create, delete: if false;
      allow update: if (isOperator(orgId) || isOrgAdmin(orgId))
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['status', 'operatorNote', 'acknowledgedAt', 'resolvedAt', 'resolvedBy', 'responderUid']);
    }
  }
}
"""

FILES["storage.rules"] = r"""rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
"""

FILES["database.rules.json"] = """{
  "rules": {
    "alerts": {
      "$orgId": {
        "live": {
          ".read": "auth != null && auth.token.orgId === $orgId",
          ".write": "auth != null && auth.token.orgId === $orgId && newData.hasChildren() && data.exists()",
          "$alertId": {
            ".validate": "newData.hasChildren(['status'])"
          }
        }
      }
    }
  }
}
"""

# ============================================================
# main.py
# ============================================================
FILES["main.py"] = '''import firebase_admin
from firebase_admin import credentials
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    "storageBucket": "netra-ai-prod.appspot.com",
    "databaseURL": "https://netra-ai-prod.firebaseio.com"
})

from workers.celery_app import celery_app
from api.routes import auth, cameras, incidents, config

app = FastAPI(
    title="Netra.AI Control Plane API",
    description="SaaS Backend for CCTV Threat Detection",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://app.netra.ai"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(cameras.router, prefix="/cameras", tags=["Cameras"])
app.include_router(incidents.router, prefix="/incidents", tags=["Incidents"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Netra.AI API"}
'''

# ============================================================
# api/
# ============================================================
FILES["api/__init__.py"] = ""

FILES["api/dependencies.py"] = '''from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
from pydantic import BaseModel
from typing import List, Callable

security = HTTPBearer()

class CurrentUser(BaseModel):
    uid: str
    email: str
    org_id: str
    role: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> CurrentUser:
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token.get("uid")
        email = decoded_token.get("email", "")
        org_id = decoded_token.get("orgId")
        role = decoded_token.get("role")
        if not org_id or not role:
            raise HTTPException(status_code=403, detail="User lacks organization or role assignment. Complete onboarding.")
        return CurrentUser(uid=uid, email=email, org_id=org_id, role=role)
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

def require_role(allowed_roles: List[str]) -> Callable:
    def role_checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Operation not permitted. Required roles: {allowed_roles}. Your role: {current_user.role}."
            )
        return current_user
    return role_checker
'''

FILES["api/routes/__init__.py"] = ""

FILES["api/routes/auth.py"] = '''from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from firebase_admin import auth
from api.dependencies import CurrentUser, require_role

router = APIRouter()

class InviteRequest(BaseModel):
    target_email: str
    target_role: str

@router.post("/members/invite")
def invite_existing_user(
    invite_data: InviteRequest,
    current_user: CurrentUser = Depends(require_role(["org_admin"]))
):
    valid_roles = ["operator", "viewer", "responder", "org_admin"]
    if invite_data.target_role not in valid_roles:
        raise HTTPException(status_code=400, detail="Invalid role specified.")
    try:
        target_user = auth.get_user_by_email(invite_data.target_email)
        existing_claims = target_user.custom_claims or {}
        if existing_claims.get("orgId"):
            raise HTTPException(status_code=400, detail="User already belongs to an organization.")
        claims = {"orgId": current_user.org_id, "role": invite_data.target_role}
        auth.set_custom_user_claims(target_user.uid, claims)
        return {"message": f"Successfully assigned {invite_data.target_email} as {invite_data.target_role}."}
    except auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found. They must sign up first.")

def create_org_admin(email: str, password: str, display_name: str, org_id: str) -> str:
    user = auth.create_user(email=email, password=password, display_name=display_name)
    claims = {"orgId": org_id, "role": "org_admin"}
    auth.set_custom_user_claims(user.uid, claims)
    return user.uid
'''

FILES["api/routes/cameras.py"] = '''from fastapi import APIRouter
router = APIRouter()
# Camera management routes placeholder
'''

FILES["api/routes/incidents.py"] = '''from fastapi import APIRouter
router = APIRouter()
# Incident management routes placeholder
'''

FILES["api/routes/config.py"] = '''from fastapi import APIRouter
router = APIRouter()
# Alert configuration routes placeholder
'''

# ============================================================
# core/
# ============================================================
FILES["core/__init__.py"] = ""
FILES["core/config.py"] = ""
FILES["core/schemas/__init__.py"] = ""
FILES["core/schemas/camera.py"] = ""
FILES["core/schemas/incident.py"] = ""
FILES["core/schemas/user.py"] = ""

# ============================================================
# services/
# ============================================================
FILES["services/__init__.py"] = ""

FILES["services/twilio_client.py"] = '''import os
import logging
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

logger = logging.getLogger(__name__)

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER")

if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
else:
    client = None
    logger.warning("Twilio credentials missing. SMS functionality will be disabled.")

def send_sms(to: str, body: str) -> bool:
    if not client:
        logger.error(f"Cannot send SMS to {to}: Twilio client not initialized.")
        return False
    try:
        message = client.messages.create(body=body, from_=TWILIO_FROM_NUMBER, to=to)
        logger.info(f"Twilio SMS dispatched. SID: {message.sid}")
        return True
    except TwilioRestException as e:
        logger.error(f"Twilio API Error while sending to {to}: {e.msg}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error while sending SMS to {to}: {str(e)}")
        return False
'''

FILES["services/mqtt_client.py"] = '''import os
import time
import json
import logging
import paho.mqtt.publish as publish

logger = logging.getLogger(__name__)

MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST")
MQTT_BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", 1883))

def trigger_alarm(org_id: str, camera_id: str):
    if not MQTT_BROKER_HOST:
        logger.warning(f"[{camera_id}] MQTT_BROKER_HOST not configured. Alarm skipped.")
        return
    topic = f"netra/alarms/{org_id}/{camera_id}"
    payload = {"alarm": True, "timestamp": int(time.time()), "source": "Netra.AI Central", "command": "TRIGGER_SIREN"}
    try:
        publish.single(topic=topic, payload=json.dumps(payload), hostname=MQTT_BROKER_HOST, port=MQTT_BROKER_PORT)
        logger.info(f"[{camera_id}] Published MQTT Alarm payload to topic [ {topic} ]")
    except Exception as e:
        logger.error(f"[{camera_id}] Failed to publish MQTT alarm: {str(e)}")
'''

FILES["services/storage.py"] = '''import datetime
from firebase_admin import storage

def upload_evidence(org_id: str, incident_id: str, file_path: str, file_type: str) -> str:
    bucket = storage.bucket()
    if file_type == "clip":
        destination_blob_name = f"clips/{org_id}/{incident_id}/clip.mp4"
        content_type = "video/mp4"
    elif file_type == "snapshot":
        destination_blob_name = f"snapshots/{org_id}/{incident_id}.jpg"
        content_type = "image/jpeg"
    else:
        raise ValueError("Invalid file_type. Must be clip or snapshot.")
    blob = bucket.blob(destination_blob_name)
    blob.upload_from_filename(file_path, content_type=content_type)
    signed_url = blob.generate_signed_url(version="v4", expiration=datetime.timedelta(hours=1), method="GET")
    return signed_url
'''

FILES["services/rtdb.py"] = '''import time
from firebase_admin import db

def trigger_live_alert(org_id: str, incident_id: str, threat_type: str,
                       camera_name: str, zone_name: str, confidence: float, snapshot_url: str):
    alerts_ref = db.reference(f"alerts/{org_id}/live")
    new_alert_ref = alerts_ref.push()
    current_time_ms = int(time.time() * 1000)
    expires_at_ms = current_time_ms + (5 * 60 * 1000)
    alert_payload = {
        "incidentId": incident_id,
        "threatType": threat_type,
        "cameraName": camera_name,
        "zoneName": zone_name,
        "confidence": confidence,
        "snapshotUrl": snapshot_url,
        "status": "alerted",
        "timestamp": current_time_ms,
        "expiresAt": expires_at_ms
    }
    new_alert_ref.set(alert_payload)
    return new_alert_ref.key

def remove_live_alert(org_id: str, alert_id: str):
    db.reference(f"alerts/{org_id}/live/{alert_id}").delete()
'''

# ============================================================
# workers/
# ============================================================
FILES["workers/__init__.py"] = ""

FILES["workers/celery_app.py"] = '''import os
from celery import Celery

celery_app = Celery("netra_tasks", broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"))
'''

FILES["workers/rtbd_cleanup.py"] = '''import time
from firebase_admin import db
from workers.celery_app import celery_app

@celery_app.task
def cleanup_stale_alerts():
    current_time_ms = int(time.time() * 1000)
    alerts_ref = db.reference("alerts")
    all_orgs_data = alerts_ref.get()
    if not all_orgs_data:
        return "No alerts node found."
    deleted_count = 0
    for org_id, org_data in all_orgs_data.items():
        if "live" in org_data:
            live_alerts = org_data["live"]
            for alert_id, alert_data in live_alerts.items():
                expires_at = alert_data.get("expiresAt", 0)
                if expires_at < current_time_ms:
                    db.reference(f"alerts/{org_id}/live/{alert_id}").delete()
                    deleted_count += 1
    return f"Cleaned up {deleted_count} stale alerts."
'''

FILES["workers/tasks.py"] = '''import os
import cv2
import uuid
import struct
import numpy as np
from firebase_admin import firestore
from services.twilio_client import send_sms
from services.mqtt_client import trigger_alarm
from services.storage import upload_evidence
from workers.celery_app import celery_app
from workers.rtbd_cleanup import cleanup_stale_alerts

@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    sender.add_periodic_task(60.0, cleanup_stale_alerts.s(), name="cleanup_rtbd_every_minute")

@celery_app.task
def dispatch_alert_tasks(org_id: str, incident_id: str, threat_type: str,
                         camera_id: str, camera_name: str, zone_name: str, confidence: float):
    db = firestore.client()
    users_ref = db.collection("users")
    query = users_ref.where("orgId", "==", org_id).where("notifyViaSMS", "==", True).stream()
    phone_numbers = [doc.to_dict().get("phone") for doc in query if doc.to_dict().get("phone")]
    if phone_numbers:
        front_end_url = os.getenv("FRONTEND_URL", "https://app.netra.ai")
        message = (
            f"[NETRA.AI ALERT] {threat_type} detected at {camera_name} ({zone_name}).\\n"
            f"Confidence: {int(confidence * 100)}%.\\n"
            f"View incident: {front_end_url}/incidents/{org_id}/{incident_id}"
        )
        send_sms_alert.delay(phone_numbers, message)
    trigger_alarm(org_id, camera_id)
    extract_and_upload_clip.apply_async(args=[org_id, incident_id, camera_id], countdown=10)

@celery_app.task
def send_sms_alert(phone_numbers: list, message: str):
    success_count = 0
    for phone in phone_numbers:
        if send_sms(to=phone, body=message):
            success_count += 1
    return f"Sent SMS to {success_count}/{len(phone_numbers)} responders."

@celery_app.task
def extract_and_upload_clip(org_id: str, incident_id: str, camera_id: str):
    import redis
    r = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    key = f"frames:{org_id}:{camera_id}"
    items = r.lrange(key, 0, -1)
    if not items:
        return "No frames found in Redis buffer."
    items.reverse()
    temp_clip_path = f"/tmp/{uuid.uuid4().hex}_clip.mp4"
    video_writer = None
    try:
        for item in items:
            meta_len, = struct.unpack(">I", item[:4])
            jpeg_bytes = item[4 + meta_len:]
            nparr = np.frombuffer(jpeg_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if video_writer is None:
                h, w, _ = frame.shape
                fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                video_writer = cv2.VideoWriter(temp_clip_path, fourcc, 5.0, (w, h))
            video_writer.write(frame)
    finally:
        if video_writer:
            video_writer.release()
    signed_clip_url = upload_evidence(org_id, incident_id, temp_clip_path, "clip")
    if os.path.exists(temp_clip_path):
        os.remove(temp_clip_path)
    db = firestore.client()
    db.collection(f"incidents/{org_id}").document(incident_id).update({"clipUrl": signed_clip_url})
    return f"Clip uploaded for incident {incident_id}"
'''

# ============================================================
# pipeline/ingestion/
# ============================================================
FILES["pipeline/__init__.py"] = ""
FILES["pipeline/ingestion/__init__.py"] = ""

FILES["pipeline/ingestion/frame_buffer.py"] = '''import redis
import struct
import json
from typing import Optional, Dict, Any

class FrameBuffer:
    def __init__(self, redis_url: str = "redis://localhost:6379/0", max_depth: int = 30):
        self.redis = redis.Redis.from_url(redis_url)
        self.max_depth = max_depth

    def push_frame(self, org_id: str, camera_id: str, jpeg_bytes: bytes, metadata: Dict[str, Any]):
        key = f"frames:{org_id}:{camera_id}"
        meta_bytes = json.dumps(metadata).encode("utf-8")
        meta_len = len(meta_bytes)
        payload = struct.pack(f">I{meta_len}s", meta_len, meta_bytes) + jpeg_bytes
        pipeline = self.redis.pipeline()
        pipeline.lpush(key, payload)
        pipeline.ltrim(key, 0, self.max_depth - 1)
        pipeline.execute()

    def pop_frame(self, org_id: str, camera_id: str) -> Optional[Dict[str, Any]]:
        key = f"frames:{org_id}:{camera_id}"
        item = self.redis.rpop(key)
        if not item:
            return None
        meta_len, = struct.unpack(">I", item[:4])
        meta_bytes = item[4:4 + meta_len]
        jpeg_bytes = item[4 + meta_len:]
        metadata = json.loads(meta_bytes.decode("utf-8"))
        return {"metadata": metadata, "frame_bytes": jpeg_bytes}
'''

FILES["pipeline/ingestion/rtsp_reader.py"] = '''import cv2
import time
import logging
import multiprocessing
from firebase_admin import firestore
from pipeline.ingestion.frame_buffer import FrameBuffer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_camera_status(org_id: str, camera_id: str, status: str):
    try:
        db = firestore.client()
        db.collection(f"cameras/{org_id}").document(camera_id).update({"status": status})
    except Exception as e:
        logger.error(f"[{camera_id}] Failed to update status: {e}")

def camera_reader_process(org_id: str, camera_id: str, rtsp_url: str, fps_cap: int = 5,
                          redis_url: str = "redis://localhost:6379/0"):
    buffer = FrameBuffer(redis_url=redis_url, max_depth=30)
    max_retries = 5
    retry_count = 0
    base_backoff = 2
    frame_interval = 1.0 / fps_cap
    while retry_count <= max_retries:
        logger.info(f"[{camera_id}] Connecting to RTSP stream (Attempt {retry_count + 1})...")
        update_camera_status(org_id, camera_id, "live")
        cap = cv2.VideoCapture(rtsp_url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        last_frame_time = 0
        stream_active = cap.isOpened()
        if stream_active:
            retry_count = 0
            logger.info(f"[{camera_id}] Stream connected successfully.")
        while stream_active:
            ret, frame = cap.read()
            if not ret:
                stream_active = False
                break
            current_time = time.time()
            if (current_time - last_frame_time) >= frame_interval:
                _, buffer_img = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                jpeg_bytes = buffer_img.tobytes()
                metadata = {
                    "timestamp": current_time,
                    "resolution_w": frame.shape[1],
                    "resolution_h": frame.shape[0],
                    "org_id": org_id,
                    "camera_id": camera_id
                }
                buffer.push_frame(org_id, camera_id, jpeg_bytes, metadata)
                last_frame_time = current_time
        cap.release()
        retry_count += 1
        if retry_count <= max_retries:
            sleep_time = base_backoff ** retry_count
            logger.warning(f"[{camera_id}] Retrying in {sleep_time}s...")
            update_camera_status(org_id, camera_id, "degraded")
            time.sleep(sleep_time)
    logger.error(f"[{camera_id}] Max retries exhausted. Marking offline.")
    update_camera_status(org_id, camera_id, "offline")

def spawn_camera_process(org_id: str, camera_id: str, rtsp_url: str) -> multiprocessing.Process:
    p = multiprocessing.Process(target=camera_reader_process, args=(org_id, camera_id, rtsp_url), daemon=True)
    p.start()
    return p
'''

# ============================================================
# pipeline/ai/
# ============================================================
FILES["pipeline/ai/__init__.py"] = ""

FILES["pipeline/ai/models.py"] = '''import time
import logging
from typing import List, Optional
from pydantic import BaseModel
import numpy as np
import cv2
from ultralytics import YOLO

logger = logging.getLogger(__name__)

class Detection(BaseModel):
    bbox: List[float]
    keypoints: Optional[List[List[float]]] = None
    confidence: float
    track_id: Optional[int] = None

class ThreatDetectorSingleton:
    _instance = None
    def __new__(cls, model_path="yolov8n-pose.onnx"):
        if cls._instance is None:
            cls._instance = super(ThreatDetectorSingleton, cls).__new__(cls)
            cls._instance._initialize(model_path)
        return cls._instance
    def _initialize(self, model_path: str):
        logger.info(f"Loading YOLOv8 Pose model from {model_path}...")
        self.model = YOLO(model_path, task="pose")
        logger.info("Pose Inference Model Initialized successfully.")
    def run_inference(self, frame_bytes: bytes) -> List[Detection]:
        start_time = time.time()
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return []
        results = self.model(frame, classes=[0], verbose=False)
        detections = []
        if len(results) > 0:
            result = results[0]
            boxes = result.boxes
            keypoints = result.keypoints
            for i in range(len(boxes)):
                box = boxes[i].xyxy[0].cpu().numpy().tolist()
                conf = float(boxes[i].conf[0].cpu().numpy())
                kpts_list = None
                if keypoints is not None and keypoints.has_visible:
                    kpts_list = keypoints.data[i].cpu().numpy().tolist()
                detections.append(Detection(bbox=box, keypoints=kpts_list, confidence=conf, track_id=None))
        latency_ms = (time.time() - start_time) * 1000
        logger.debug(f"Inference: {latency_ms:.2f}ms | Persons: {len(detections)}")
        return detections
'''

FILES["pipeline/ai/tracker.py"] = '''import torch
import numpy as np
from typing import List, Dict
from types import SimpleNamespace
from pipeline.ai.models import Detection
from ultralytics.trackers.byte_tracker import BYTETracker

def calculate_iou(box1, box2):
    x1, y1 = max(box1[0], box2[0]), max(box1[1], box2[1])
    x2, y2 = min(box1[2], box2[2]), min(box1[3], box2[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    a1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    a2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    return inter / float(a1 + a2 - inter + 1e-6)

class TrackerRegistry:
    def __init__(self):
        self._trackers: Dict[str, BYTETracker] = {}
    def get_tracker(self, camera_id: str) -> BYTETracker:
        if camera_id not in self._trackers:
            args = SimpleNamespace(
                track_high_thresh=0.5, track_low_thresh=0.1, new_track_thresh=0.6,
                track_buffer=10, match_thresh=0.8, gsi=False, mot20=False
            )
            self._trackers[camera_id] = BYTETracker(args, frame_rate=5)
        return self._trackers[camera_id]
    def update_tracks(self, camera_id: str, detections: List[Detection], img_shape: tuple) -> List[Detection]:
        tracker = self.get_tracker(camera_id)
        if not detections:
            tracker.update(torch.empty((0, 5)), img_shape)
            return []
        dets_array = [[d.bbox[0], d.bbox[1], d.bbox[2], d.bbox[3], d.confidence, 0.0] for d in detections]
        dets_tensor = torch.tensor(dets_array, dtype=torch.float32)
        dummy_img = torch.zeros((img_shape[0], img_shape[1], 3))
        tracks = tracker.update(dets_tensor, dummy_img)
        assigned = []
        for track in tracks:
            best_iou, best_det = 0, None
            for det in detections:
                iou = calculate_iou(track.tlbr, det.bbox)
                if iou > best_iou:
                    best_iou, best_det = iou, det
            if best_det and best_iou > 0.5:
                assigned.append(Detection(bbox=best_det.bbox, keypoints=best_det.keypoints,
                                          confidence=best_det.confidence, track_id=track.track_id))
        return assigned
'''

FILES["pipeline/ai/heuristics.py"] = '''from dataclasses import dataclass
from typing import List, Dict
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
        self.drop_time_frames = int(1.0 * fps)
        self.still_time_frames = int(1.5 * fps)
        self.required_history = self.drop_time_frames + self.still_time_frames
    def evaluate(self, track_history, current_detections, camera_id, frame_height):
        events = []
        for det in current_detections:
            if not det.track_id:
                continue
            history = track_history.get(det.track_id, [])
            if len(history) < self.required_history:
                continue
            recent = history[-self.required_history:]
            def get_y(d):
                if d.keypoints and len(d.keypoints) > 12:
                    return (d.keypoints[11][1] + d.keypoints[12][1]) / 2.0
                return d.bbox[3]
            y_coords = [get_y(d) for d in recent]
            drop = y_coords[self.drop_time_frames] - y_coords[0]
            if drop > (frame_height * 0.40):
                post = y_coords[self.drop_time_frames:]
                if (max(post) - min(post)) < (frame_height * 0.10):
                    events.append(ThreatEvent("Sudden Fall", det.track_id, camera_id, 0.85, det.bbox))
        return events

class RestrictedZoneDetector:
    def __init__(self, zones_config: list):
        self.zones = zones_config
        self.ist_tz = pytz.timezone("Asia/Kolkata")
    def evaluate(self, track_history, current_detections, camera_id):
        events = []
        now_ist = datetime.datetime.now(self.ist_tz)
        current_time_str = now_ist.strftime("%H:%M")
        for det in current_detections:
            if not det.track_id:
                continue
            cx = (det.bbox[0] + det.bbox[2]) / 2.0
            cy = (det.bbox[1] + det.bbox[3]) / 2.0
            point = (float(cx), float(cy))
            for zone in self.zones:
                start_h, end_h = zone["activeHours"]["start"], zone["activeHours"]["end"]
                if start_h <= end_h:
                    is_active = start_h <= current_time_str <= end_h
                else:
                    is_active = current_time_str >= start_h or current_time_str <= end_h
                if not is_active:
                    continue
                pts = np.array([[p["x"], p["y"]] for p in zone["coordinates"]], np.int32).reshape((-1, 1, 2))
                dist = cv2.pointPolygonTest(pts, point, measureDist=True)
                if dist >= 0:
                    confidence = min(1.0, 0.70 + (dist / 100.0) * 0.30)
                    events.append(ThreatEvent("RestrictedZone", det.track_id, camera_id, round(confidence, 2), det.bbox))
                    break
        return events
'''

FILES["pipeline/ai/classifier.py"] = '''import os
import logging
import numpy as np
from typing import List, Dict, Optional
import onnxruntime as ort
from pipeline.ai.models import Detection
from pipeline.ai.heuristics import ThreatEvent

logger = logging.getLogger(__name__)

class SequenceBuilder:
    def __init__(self, sequence_length: int = 30):
        self.sequence_length = sequence_length
        self.buffers: Dict[int, List[List[float]]] = {}
    def _normalize_keypoints(self, det: Detection) -> List[float]:
        if not det.keypoints:
            return [0.0] * 34
        cx = (det.bbox[0] + det.bbox[2]) / 2.0
        cy = (det.bbox[1] + det.bbox[3]) / 2.0
        w = max(det.bbox[2] - det.bbox[0], 1.0)
        h = max(det.bbox[3] - det.bbox[1], 1.0)
        normalized = []
        for kpt in det.keypoints:
            normalized.extend([(kpt[0] - cx) / w, (kpt[1] - cy) / h])
        return normalized
    def add_detection(self, det: Detection) -> Optional[np.ndarray]:
        if det.track_id is None:
            return None
        norm = self._normalize_keypoints(det)
        if det.track_id not in self.buffers:
            self.buffers[det.track_id] = []
        self.buffers[det.track_id].append(norm)
        if len(self.buffers[det.track_id]) > self.sequence_length:
            self.buffers[det.track_id].pop(0)
        if len(self.buffers[det.track_id]) == self.sequence_length:
            return np.array([self.buffers[det.track_id]], dtype=np.float32)
        return None
    def remove_track(self, track_id: int):
        self.buffers.pop(track_id, None)

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
            logger.warning(f"LSTM model not found at {self.model_path}. Behavior classification disabled.")
            return
        try:
            providers = ["TensorrtExecutionProvider", "CUDAExecutionProvider", "CPUExecutionProvider"]
            self.session = ort.InferenceSession(self.model_path, providers=providers)
            self.input_name = self.session.get_inputs()[0].name
            logger.info("LSTM Behavior Classifier initialized.")
        except Exception as e:
            logger.error(f"Failed to load LSTM model: {e}")
    def evaluate(self, current_detections: List[Detection], camera_id: str) -> List[ThreatEvent]:
        events = []
        for det in current_detections:
            if not det.track_id:
                continue
            seq_input = self.sequence_builder.add_detection(det)
            if seq_input is None or self.session is None:
                continue
            outputs = self.session.run(None, {self.input_name: seq_input})
            probs = outputs[0][0]
            idx = np.argmax(probs)
            conf = float(probs[idx])
            cls = self.classes[idx]
            if cls in ["Struggling", "Chasing"] and conf >= self.threshold:
                events.append(ThreatEvent(cls, det.track_id, camera_id, round(conf, 2), det.bbox))
        return events
'''

# ============================================================
# pipeline/orchestrator.py
# ============================================================
FILES["pipeline/orchestrator.py"] = '''import time
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
from services.rtdb import trigger_live_alert
from services.storage import upload_evidence

logger = logging.getLogger(__name__)

class CameraOrchestrator:
    def __init__(self, org_id: str, camera_id: str, redis_url: str = "redis://localhost:6379/0"):
        self.org_id = org_id
        self.camera_id = camera_id
        self.buffer = FrameBuffer(redis_url=redis_url, max_depth=30)
        self.db = firestore.client()
        self.detector = ThreatDetectorSingleton()
        self.tracker_registry = TrackerRegistry()
        self.lstm_classifier = BehaviorClassifier()
        self.fall_detector = FallDetector(fps=5)
        self.zone_detector = RestrictedZoneDetector(zones_config=[])
        self.track_history: Dict[int, List[Detection]] = {}
        self.history_max_len = 50
        self.alert_cooldowns: Dict[tuple, float] = {}
        self.cooldown_period = 30.0
        self.last_zone_refresh = 0.0
        self.zone_refresh_interval = 300.0

    def _refresh_zones(self):
        now = time.time()
        if (now - self.last_zone_refresh) < self.zone_refresh_interval and self.last_zone_refresh != 0:
            return
        zones_ref = self.db.collection(f"zones/{self.org_id}")
        query = zones_ref.where("cameraId", "==", self.camera_id).stream()
        self.zone_detector = RestrictedZoneDetector(zones_config=[doc.to_dict() for doc in query])
        self.last_zone_refresh = now

    def _update_track_history(self, current_detections):
        for det in current_detections:
            if det.track_id is None:
                continue
            if det.track_id not in self.track_history:
                self.track_history[det.track_id] = []
            self.track_history[det.track_id].append(det)
            if len(self.track_history[det.track_id]) > self.history_max_len:
                self.track_history[det.track_id].pop(0)

    def _handle_threat(self, event: ThreatEvent, frame_bytes: bytes):
        now = time.time()
        key = (event.track_id, event.threat_type)
        if key in self.alert_cooldowns and (now - self.alert_cooldowns[key]) < self.cooldown_period:
            return
        self.alert_cooldowns[key] = now
        incident_id = f"inc_{uuid.uuid4().hex[:8]}"
        temp_snap = f"/tmp/{incident_id}.jpg"
        with open(temp_snap, "wb") as f:
            f.write(frame_bytes)
        snapshot_url = upload_evidence(self.org_id, incident_id, temp_snap, "snapshot")
        cam_doc = self.db.collection(f"cameras/{self.org_id}").document(self.camera_id).get()
        camera_name = cam_doc.to_dict().get("name", "Camera") if cam_doc.exists else "Camera"
        self.db.collection(f"incidents/{self.org_id}").document(incident_id).set({
            "cameraId": self.camera_id, "threatType": event.threat_type,
            "confidence": event.confidence, "status": "alerted",
            "detectedAt": firestore.SERVER_TIMESTAMP, "snapshotUrl": snapshot_url,
            "clipUrl": None, "operatorNote": ""
        })
        trigger_live_alert(self.org_id, incident_id, event.threat_type,
                           camera_name, "Automated Zone", event.confidence, snapshot_url)

    def run_loop(self):
        logger.info(f"[{self.camera_id}] Starting AI Orchestrator loop...")
        while True:
            try:
                self._refresh_zones()
                item = self.buffer.pop_frame(self.org_id, self.camera_id)
                if not item:
                    time.sleep(0.01)
                    continue
                frame_bytes = item["frame_bytes"]
                frame_h = item["metadata"]["resolution_h"]
                frame_w = item["metadata"]["resolution_w"]
                detections = self.detector.run_inference(frame_bytes)
                tracked = self.tracker_registry.update_tracks(self.camera_id, detections, (frame_h, frame_w))
                self._update_track_history(tracked)
                threats = []
                threats.extend(self.fall_detector.evaluate(self.track_history, tracked, self.camera_id, frame_h))
                threats.extend(self.zone_detector.evaluate(self.track_history, tracked, self.camera_id))
                threats.extend(self.lstm_classifier.evaluate(tracked, self.camera_id))
                for event in threats:
                    self._handle_threat(event, frame_bytes)
            except Exception as e:
                logger.error(f"[{self.camera_id}] Orchestrator error: {e}", exc_info=True)
                time.sleep(1)

def spawn_pipeline_for_camera(org_id: str, camera_id: str, rtsp_url: str):
    from pipeline.ingestion.rtsp_reader import spawn_camera_process
    reader_p = spawn_camera_process(org_id, camera_id, rtsp_url)
    ai_p = multiprocessing.Process(target=lambda: CameraOrchestrator(org_id, camera_id).run_loop(), daemon=True)
    ai_p.start()
    return reader_p, ai_p
'''

# ============================================================
# Write all files
# ============================================================
def main():
    created = 0
    skipped = 0
    for rel_path, content in FILES.items():
        full_path = os.path.join(BASE, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        created += 1
        print(f"  [CREATED] {rel_path}")

    print(f"\n{'='*60}")
    print(f"  Netra.AI Backend Scaffold Complete!")
    print(f"  Files created: {created}")
    print(f"  Root: {BASE}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
