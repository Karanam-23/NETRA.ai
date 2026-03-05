"""
api/routes/cameras.py
Full CRUD for cameras, with pipeline spawn/teardown integration.
"""

import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from firebase_admin import firestore

from api.dependencies import CurrentUser, get_current_user, require_role

router = APIRouter()
db = firestore.client()
logger = logging.getLogger(__name__)

# In-memory registry of running pipeline processes so we can kill them on delete.
# In production this would be managed by a process supervisor (e.g. systemd / k8s).
_pipeline_processes: dict = {}  # camera_id -> (reader_proc, ai_proc)


# ------------------------------------------------------------------ #
#  Request Schemas                                                    #
# ------------------------------------------------------------------ #

class CameraCreateRequest(BaseModel):
    name: str
    rtspUrl: str
    location: str
    zone: Optional[str] = None
    orgId: Optional[str] = None


class CameraUpdateRequest(BaseModel):
    name: Optional[str] = None
    rtspUrl: Optional[str] = None
    location: Optional[str] = None
    zone: Optional[str] = None


# ------------------------------------------------------------------ #
#  POST /cameras/                                                     #
# ------------------------------------------------------------------ #

@router.post("/")
def create_camera(
    payload: CameraCreateRequest,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """Register a new camera, store credentials, and spawn the pipeline."""
    org_id = payload.orgId or current_user.org_id
    camera_id = f"cam_{uuid.uuid4().hex[:10]}"

    # Check camera limit
    org_doc = db.collection("orgs").document(org_id).get()
    if org_doc.exists:
        org_data = org_doc.to_dict()
        current_count = org_data.get("cameraCount", 0)
        limit = org_data.get("cameraLimit", 5)
        if current_count >= limit:
            raise HTTPException(
                status_code=400,
                detail=f"Camera limit reached ({limit}). Upgrade your plan.",
            )

    now = datetime.now(timezone.utc)

    # 1. Public camera document (no secrets)
    cameras_ref = db.collection("cameras").document(org_id).collection("items")
    cameras_ref.document(camera_id).set({
        "id": camera_id,
        "name": payload.name,
        "location": payload.location,
        "zone": payload.zone or "",
        "status": "live",
        "orgId": org_id,
        "createdAt": now,
        "updatedAt": now,
    })

    # 2. Secrets subcollection (RTSP URL kept separate for security)
    cameras_ref.document(camera_id).collection("secrets").document("rtsp").set({
        "rtspUrl": payload.rtspUrl,
        "createdAt": now,
    })

    # 3. Increment org camera count
    db.collection("orgs").document(org_id).update({
        "cameraCount": firestore.Increment(1),
    })

    # 4. Spawn the ingestion + AI pipeline
    try:
        from pipeline.orchestrator import spawn_pipeline_for_camera
        reader_p, ai_p = spawn_pipeline_for_camera(org_id, camera_id, payload.rtspUrl)
        _pipeline_processes[camera_id] = (reader_p, ai_p)
    except Exception as e:
        logger.warning(f"Pipeline spawn failed for {camera_id}: {e}")
        # Camera is registered but pipeline failed — set status to degraded
        cameras_ref.document(camera_id).update({"status": "degraded"})

    return {
        "id": camera_id,
        "name": payload.name,
        "status": "live",
        "message": "Camera registered and pipeline started.",
    }


# ------------------------------------------------------------------ #
#  GET /cameras/                                                      #
# ------------------------------------------------------------------ #

@router.get("/")
def list_cameras(
    orgId: str = Query(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all cameras for an organisation."""
    if current_user.org_id != orgId and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    docs = (
        db.collection("cameras")
        .document(orgId)
        .collection("items")
        .order_by("createdAt")
        .stream()
    )

    cameras = []
    for d in docs:
        c = d.to_dict()
        cameras.append({
            "id": c.get("id", d.id),
            "name": c.get("name", ""),
            "location": c.get("location", ""),
            "zone": c.get("zone", ""),
            "status": c.get("status", "offline"),
            "rtspUrl": "",  # Don't expose secrets in list view
        })
    return cameras


# ------------------------------------------------------------------ #
#  PUT /cameras/{cameraId}                                            #
# ------------------------------------------------------------------ #

@router.put("/{camera_id}")
def update_camera(
    camera_id: str,
    payload: CameraUpdateRequest,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """Update a camera's metadata. If RTSP URL changes, restart the pipeline."""
    org_id = current_user.org_id

    cam_ref = (
        db.collection("cameras")
        .document(org_id)
        .collection("items")
        .document(camera_id)
    )
    cam_doc = cam_ref.get()
    if not cam_doc.exists:
        raise HTTPException(status_code=404, detail="Camera not found.")

    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.location is not None:
        updates["location"] = payload.location
    if payload.zone is not None:
        updates["zone"] = payload.zone

    updates["updatedAt"] = datetime.now(timezone.utc)
    cam_ref.update(updates)

    # If RTSP URL changed, update secrets and restart pipeline
    if payload.rtspUrl is not None:
        cam_ref.collection("secrets").document("rtsp").set({
            "rtspUrl": payload.rtspUrl,
            "updatedAt": datetime.now(timezone.utc),
        }, merge=True)

        # Teardown existing pipeline
        _stop_pipeline(camera_id)

        # Respawn with new URL
        try:
            from pipeline.orchestrator import spawn_pipeline_for_camera
            reader_p, ai_p = spawn_pipeline_for_camera(org_id, camera_id, payload.rtspUrl)
            _pipeline_processes[camera_id] = (reader_p, ai_p)
            cam_ref.update({"status": "live"})
        except Exception as e:
            logger.warning(f"Pipeline restart failed for {camera_id}: {e}")
            cam_ref.update({"status": "degraded"})

    return {"message": "Camera updated."}


# ------------------------------------------------------------------ #
#  DELETE /cameras/{cameraId}                                         #
# ------------------------------------------------------------------ #

@router.delete("/{camera_id}")
def delete_camera(
    camera_id: str,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """Delete camera document, secrets, and stop the pipeline."""
    org_id = current_user.org_id

    cam_ref = (
        db.collection("cameras")
        .document(org_id)
        .collection("items")
        .document(camera_id)
    )
    if not cam_ref.get().exists:
        raise HTTPException(status_code=404, detail="Camera not found.")

    # 1. Stop pipeline processes
    _stop_pipeline(camera_id)

    # 2. Delete secrets subcollection
    for secret_doc in cam_ref.collection("secrets").stream():
        secret_doc.reference.delete()

    # 3. Delete camera document
    cam_ref.delete()

    # 4. Decrement org camera count
    db.collection("orgs").document(org_id).update({
        "cameraCount": firestore.Increment(-1),
    })

    return {"message": "Camera deleted and pipeline stopped."}


# ------------------------------------------------------------------ #
#  GET /cameras/{cameraId}/status                                     #
# ------------------------------------------------------------------ #

@router.get("/{camera_id}/status")
def get_camera_status(
    camera_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Returns current status of a single camera."""
    org_id = current_user.org_id

    cam_doc = (
        db.collection("cameras")
        .document(org_id)
        .collection("items")
        .document(camera_id)
        .get()
    )
    if not cam_doc.exists:
        raise HTTPException(status_code=404, detail="Camera not found.")

    data = cam_doc.to_dict()
    return {
        "id": camera_id,
        "name": data.get("name", ""),
        "status": data.get("status", "offline"),
    }


# ------------------------------------------------------------------ #
#  Helper: stop pipeline processes                                    #
# ------------------------------------------------------------------ #

def _stop_pipeline(camera_id: str):
    """Terminate the reader and AI processes for a camera."""
    procs = _pipeline_processes.pop(camera_id, None)
    if procs:
        reader_p, ai_p = procs
        for p in (reader_p, ai_p):
            try:
                if p and p.is_alive():
                    p.terminate()
                    p.join(timeout=5)
            except Exception as e:
                logger.warning(f"Failed to stop process for {camera_id}: {e}")
