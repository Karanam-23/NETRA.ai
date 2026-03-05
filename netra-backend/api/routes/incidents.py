"""
api/routes/incidents.py
Paginated incident list, detail, status updates, and CSV export.
"""

import csv
import io
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from firebase_admin import firestore

from api.dependencies import CurrentUser, get_current_user, require_role

router = APIRouter()
db = firestore.client()


# ------------------------------------------------------------------ #
#  Schemas                                                            #
# ------------------------------------------------------------------ #

class IncidentPatchRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    assignedTo: Optional[str] = None


# ------------------------------------------------------------------ #
#  GET /incidents/{orgId}  — paginated list with filters              #
# ------------------------------------------------------------------ #

@router.get("/{org_id}")
def list_incidents(
    org_id: str,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    threatType: Optional[str] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return paginated, filterable incidents for an organization."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    col_ref = db.collection("incidents").document(org_id).collection("items")

    # Build query with progressive filters
    query = col_ref.order_by("detectedAt", direction=firestore.Query.DESCENDING)

    if status:
        query = query.where("status", "==", status)
    if threatType:
        query = query.where("threatType", "==", threatType)

    # Fetch all matching docs (Firestore doesn't do native offset pagination)
    all_docs = list(query.stream())

    # Client-side date filtering (Firestore compound query limits)
    if dateFrom:
        try:
            dt_from = datetime.fromisoformat(dateFrom).replace(tzinfo=timezone.utc)
            all_docs = [
                d for d in all_docs
                if _get_dt(d.to_dict().get("detectedAt")) >= dt_from
            ]
        except ValueError:
            pass

    if dateTo:
        try:
            dt_to = datetime.fromisoformat(dateTo).replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
            all_docs = [
                d for d in all_docs
                if _get_dt(d.to_dict().get("detectedAt")) <= dt_to
            ]
        except ValueError:
            pass

    total = len(all_docs)

    # Paginate
    start = (page - 1) * pageSize
    end = start + pageSize
    page_docs = all_docs[start:end]

    items = []
    for d in page_docs:
        data = d.to_dict()
        # Resolve camera name from the camera doc
        camera_name = data.get("cameraName", "")
        if not camera_name:
            cam_id = data.get("cameraId", "")
            cam_doc = (
                db.collection("cameras")
                .document(org_id)
                .collection("items")
                .document(cam_id)
                .get()
            )
            camera_name = cam_doc.to_dict().get("name", cam_id) if cam_doc.exists else cam_id

        items.append({
            "id": d.id,
            "threatType": data.get("threatType", ""),
            "cameraName": camera_name,
            "cameraId": data.get("cameraId", ""),
            "zoneName": data.get("zoneName", data.get("zone", "")),
            "confidence": data.get("confidence", 0),
            "status": data.get("status", "alerted"),
            "detectedAt": _format_dt(data.get("detectedAt")),
            "acknowledgedAt": _format_dt(data.get("acknowledgedAt")),
            "resolvedAt": _format_dt(data.get("resolvedAt")),
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


# ------------------------------------------------------------------ #
#  GET /incidents/{orgId}/{id}  — single incident                     #
# ------------------------------------------------------------------ #

@router.get("/{org_id}/{incident_id}")
def get_incident(
    org_id: str,
    incident_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Fetch full detail for a single incident."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    doc = (
        db.collection("incidents")
        .document(org_id)
        .collection("items")
        .document(incident_id)
        .get()
    )
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Incident not found.")

    data = doc.to_dict()

    # Resolve camera name
    cam_id = data.get("cameraId", "")
    cam_doc = (
        db.collection("cameras")
        .document(org_id)
        .collection("items")
        .document(cam_id)
        .get()
    )
    camera_name = cam_doc.to_dict().get("name", cam_id) if cam_doc.exists else cam_id

    return {
        "id": doc.id,
        "threatType": data.get("threatType", ""),
        "cameraName": camera_name,
        "cameraId": cam_id,
        "zoneName": data.get("zoneName", data.get("zone", "")),
        "confidence": data.get("confidence", 0),
        "status": data.get("status", "alerted"),
        "detectedAt": _format_dt(data.get("detectedAt")),
        "alertedAt": _format_dt(data.get("detectedAt")),  # same as detected for now
        "acknowledgedAt": _format_dt(data.get("acknowledgedAt")),
        "resolvedAt": _format_dt(data.get("resolvedAt")),
        "snapshotUrl": data.get("snapshotUrl", ""),
        "clipUrl": data.get("clipUrl", ""),
        "notes": data.get("operatorNote", data.get("notes", "")),
        "assignedTo": data.get("assignedTo", ""),
    }


# ------------------------------------------------------------------ #
#  PATCH /incidents/{orgId}/{id}  — update status / notes             #
# ------------------------------------------------------------------ #

@router.patch("/{org_id}/{incident_id}")
def patch_incident(
    org_id: str,
    incident_id: str,
    payload: IncidentPatchRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update incident status, operator notes, or responder assignment."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    doc_ref = (
        db.collection("incidents")
        .document(org_id)
        .collection("items")
        .document(incident_id)
    )
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Incident not found.")

    updates = {}
    now = datetime.now(timezone.utc)

    if payload.status is not None:
        valid_statuses = ["alerted", "acknowledged", "resolved", "false_positive"]
        if payload.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Use: {valid_statuses}")
        updates["status"] = payload.status

        if payload.status == "acknowledged":
            updates["acknowledgedAt"] = now
            updates["acknowledgedBy"] = current_user.uid
        elif payload.status in ("resolved", "false_positive"):
            updates["resolvedAt"] = now
            updates["resolvedBy"] = current_user.uid

    if payload.notes is not None:
        updates["operatorNote"] = payload.notes

    if payload.assignedTo is not None:
        updates["assignedTo"] = payload.assignedTo

    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update.")

    updates["updatedAt"] = now
    doc_ref.update(updates)

    # If acknowledging, also remove the live alert from RTDB
    if payload.status in ("acknowledged", "resolved", "false_positive"):
        try:
            from services.rtdb import remove_live_alert
            remove_live_alert(org_id, incident_id)
        except Exception:
            pass  # Non-critical if RTDB entry already expired

    return {"message": "Incident updated.", "status": payload.status}


# ------------------------------------------------------------------ #
#  PATCH /incidents/{orgId}/alerts/{alertKey}/acknowledge              #
# ------------------------------------------------------------------ #

@router.patch("/{org_id}/alerts/{alert_key}/acknowledge")
def acknowledge_alert(
    org_id: str,
    alert_key: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Quick-acknowledge from the dashboard live feed."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    try:
        from services.rtdb import remove_live_alert
        remove_live_alert(org_id, alert_key)
    except Exception:
        pass

    return {"message": "Alert acknowledged."}


# ------------------------------------------------------------------ #
#  PATCH /incidents/{orgId}/alerts/{alertKey}/escalate                 #
# ------------------------------------------------------------------ #

@router.patch("/{org_id}/alerts/{alert_key}/escalate")
def escalate_alert(
    org_id: str,
    alert_key: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Quick-escalate from the dashboard live feed."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    # For now, mark in RTDB as escalated (could trigger SMS in the future)
    try:
        from firebase_admin import db as rtdb_module
        ref = rtdb_module.reference(f"alerts/{org_id}/live/{alert_key}")
        ref.update({"status": "escalated"})
    except Exception:
        pass

    return {"message": "Alert escalated."}


# ------------------------------------------------------------------ #
#  GET /incidents/{orgId}/export  — CSV download                      #
# ------------------------------------------------------------------ #

@router.get("/{org_id}/export")
def export_incidents_csv(
    org_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate and stream a CSV of all incidents."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    docs = (
        db.collection("incidents")
        .document(org_id)
        .collection("items")
        .order_by("detectedAt", direction=firestore.Query.DESCENDING)
        .stream()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Incident ID",
        "Threat Type",
        "Camera ID",
        "Confidence",
        "Status",
        "Detected At",
        "Acknowledged At",
        "Resolved At",
        "Notes",
    ])

    for d in docs:
        data = d.to_dict()
        writer.writerow([
            d.id,
            data.get("threatType", ""),
            data.get("cameraId", ""),
            round(data.get("confidence", 0) * 100, 1),
            data.get("status", ""),
            _format_dt(data.get("detectedAt")),
            _format_dt(data.get("acknowledgedAt")),
            _format_dt(data.get("resolvedAt")),
            data.get("operatorNote", ""),
        ])

    output.seek(0)
    filename = f"incidents_{org_id}_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ------------------------------------------------------------------ #
#  Helpers                                                            #
# ------------------------------------------------------------------ #

def _get_dt(val) -> datetime:
    """Coerce a Firestore timestamp / ISO string / None into a datetime."""
    if val is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val).replace(tzinfo=timezone.utc)
        except ValueError:
            return datetime.min.replace(tzinfo=timezone.utc)
    # Firestore DatetimeWithNanoseconds
    try:
        return val.replace(tzinfo=timezone.utc)
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


def _format_dt(val) -> Optional[str]:
    """Format a Firestore timestamp to ISO string, or return None."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, str):
        return val
    try:
        return val.isoformat()
    except Exception:
        return str(val)
