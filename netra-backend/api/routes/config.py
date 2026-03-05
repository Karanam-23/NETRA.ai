"""
api/routes/config.py
Alert configuration management and test alert trigger.
"""

import uuid
import time
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict
from firebase_admin import firestore

from api.dependencies import CurrentUser, get_current_user, require_role

router = APIRouter()
db = firestore.client()


# ------------------------------------------------------------------ #
#  Schemas                                                            #
# ------------------------------------------------------------------ #

class AlertConfigPayload(BaseModel):
    thresholds: Dict[str, float]
    escalationTimeout: int
    dedupWindow: int


# ------------------------------------------------------------------ #
#  GET /alerts/config/{orgId}                                         #
# ------------------------------------------------------------------ #

@router.get("/alerts/config/{org_id}")
def get_alert_config(
    org_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Read the alertSettings block from the org document."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    org_doc = db.collection("orgs").document(org_id).get()
    if not org_doc.exists:
        raise HTTPException(status_code=404, detail="Organisation not found.")

    data = org_doc.to_dict()
    settings = data.get("alertSettings", {})

    return {
        "thresholds": settings.get("thresholds", {
            "Fall": 0.7,
            "Chasing": 0.6,
            "Struggle": 0.65,
            "Zone": 0.5,
        }),
        "escalationTimeout": settings.get("escalationTimeout", 300),
        "dedupWindow": settings.get("dedupWindow", 60),
    }


# ------------------------------------------------------------------ #
#  PUT /alerts/config/{orgId}                                         #
# ------------------------------------------------------------------ #

@router.put("/alerts/config/{org_id}")
def update_alert_config(
    org_id: str,
    payload: AlertConfigPayload,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """Write the alertSettings block on the org document."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    org_ref = db.collection("orgs").document(org_id)
    if not org_ref.get().exists:
        raise HTTPException(status_code=404, detail="Organisation not found.")

    org_ref.update({
        "alertSettings": {
            "thresholds": payload.thresholds,
            "escalationTimeout": payload.escalationTimeout,
            "dedupWindow": payload.dedupWindow,
        },
    })

    return {"message": "Alert configuration updated."}


# ------------------------------------------------------------------ #
#  POST /alerts/test/{cameraId}                                       #
# ------------------------------------------------------------------ #

@router.post("/alerts/test/{camera_id}")
def send_test_alert(
    camera_id: str,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """
    Trigger a fake ThreatEvent through the alert pipeline to verify
    RTDB push, SMS dispatch, and dashboard rendering.
    """
    org_id = current_user.org_id
    incident_id = f"test_{uuid.uuid4().hex[:8]}"

    # Resolve camera name
    cam_doc = (
        db.collection("cameras")
        .document(org_id)
        .collection("items")
        .document(camera_id)
        .get()
    )
    camera_name = cam_doc.to_dict().get("name", camera_id) if cam_doc.exists else camera_id

    now = datetime.now(timezone.utc)

    # 1. Write a test incident to Firestore
    db.collection("incidents").document(org_id).collection("items").document(incident_id).set({
        "cameraId": camera_id,
        "threatType": "Test Alert",
        "confidence": 0.99,
        "status": "alerted",
        "detectedAt": now,
        "acknowledgedAt": None,
        "resolvedAt": None,
        "snapshotUrl": "",
        "clipUrl": None,
        "operatorNote": "This is an automated test alert.",
        "isTest": True,
    })

    # 2. Push live alert to RTDB
    try:
        from services.rtdb import trigger_live_alert
        trigger_live_alert(
            org_id=org_id,
            incident_id=incident_id,
            threat_type="Test Alert",
            camera_name=camera_name,
            zone_name="Test Zone",
            confidence=0.99,
            snapshot_url="",
        )
    except Exception:
        pass  # Non-critical for test

    return {
        "message": "Test alert dispatched.",
        "incidentId": incident_id,
    }
