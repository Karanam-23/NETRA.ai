"""
api/routes/zones.py
CRUD for restricted zones assigned to cameras.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from firebase_admin import firestore

from api.dependencies import CurrentUser, get_current_user, require_role

router = APIRouter()
db = firestore.client()


# ------------------------------------------------------------------ #
#  Schemas                                                            #
# ------------------------------------------------------------------ #

class ZoneCreateRequest(BaseModel):
    name: str
    cameraId: str
    activeHoursStart: str = "00:00"
    activeHoursEnd: str = "23:59"
    confidenceThreshold: float = 0.6
    orgId: Optional[str] = None


class ZoneUpdateRequest(BaseModel):
    name: Optional[str] = None
    cameraId: Optional[str] = None
    activeHoursStart: Optional[str] = None
    activeHoursEnd: Optional[str] = None
    confidenceThreshold: Optional[float] = None
    orgId: Optional[str] = None


# ------------------------------------------------------------------ #
#  GET /zones/                                                        #
# ------------------------------------------------------------------ #

@router.get("/")
def list_zones(
    orgId: str = Query(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all zones for an organisation."""
    if current_user.org_id != orgId and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    docs = db.collection("zones").document(orgId).collection("items").stream()
    zones = []
    for d in docs:
        z = d.to_dict()
        # Resolve camera name
        cam_id = z.get("cameraId", "")
        cam_name = cam_id
        cam_doc = (
            db.collection("cameras")
            .document(orgId)
            .collection("items")
            .document(cam_id)
            .get()
        )
        if cam_doc.exists:
            cam_name = cam_doc.to_dict().get("name", cam_id)

        zones.append({
            "id": d.id,
            "name": z.get("name", ""),
            "cameraId": cam_id,
            "cameraName": cam_name,
            "activeHoursStart": z.get("activeHoursStart", "00:00"),
            "activeHoursEnd": z.get("activeHoursEnd", "23:59"),
            "confidenceThreshold": z.get("confidenceThreshold", 0.6),
        })
    return zones


# ------------------------------------------------------------------ #
#  POST /zones/                                                       #
# ------------------------------------------------------------------ #

@router.post("/")
def create_zone(
    payload: ZoneCreateRequest,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """Create a new restricted zone."""
    org_id = payload.orgId or current_user.org_id
    zone_id = f"zone_{uuid.uuid4().hex[:10]}"

    db.collection("zones").document(org_id).collection("items").document(zone_id).set({
        "id": zone_id,
        "name": payload.name,
        "cameraId": payload.cameraId,
        "activeHoursStart": payload.activeHoursStart,
        "activeHoursEnd": payload.activeHoursEnd,
        "confidenceThreshold": payload.confidenceThreshold,
        "orgId": org_id,
        "createdAt": datetime.now(timezone.utc),
    })

    return {"id": zone_id, "message": "Zone created."}


# ------------------------------------------------------------------ #
#  PUT /zones/{zoneId}                                                #
# ------------------------------------------------------------------ #

@router.put("/{zone_id}")
def update_zone(
    zone_id: str,
    payload: ZoneUpdateRequest,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """Update an existing zone."""
    org_id = payload.orgId or current_user.org_id

    zone_ref = (
        db.collection("zones")
        .document(org_id)
        .collection("items")
        .document(zone_id)
    )
    if not zone_ref.get().exists:
        raise HTTPException(status_code=404, detail="Zone not found.")

    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.cameraId is not None:
        updates["cameraId"] = payload.cameraId
    if payload.activeHoursStart is not None:
        updates["activeHoursStart"] = payload.activeHoursStart
    if payload.activeHoursEnd is not None:
        updates["activeHoursEnd"] = payload.activeHoursEnd
    if payload.confidenceThreshold is not None:
        updates["confidenceThreshold"] = payload.confidenceThreshold

    updates["updatedAt"] = datetime.now(timezone.utc)
    zone_ref.update(updates)

    return {"message": "Zone updated."}


# ------------------------------------------------------------------ #
#  DELETE /zones/{zoneId}                                             #
# ------------------------------------------------------------------ #

@router.delete("/{zone_id}")
def delete_zone(
    zone_id: str,
    current_user: CurrentUser = Depends(require_role(["org_admin", "super_admin"])),
):
    """Delete a zone."""
    org_id = current_user.org_id

    zone_ref = (
        db.collection("zones")
        .document(org_id)
        .collection("items")
        .document(zone_id)
    )
    if not zone_ref.get().exists:
        raise HTTPException(status_code=404, detail="Zone not found.")

    zone_ref.delete()
    return {"message": "Zone deleted."}
