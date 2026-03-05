"""
api/routes/analytics.py
Aggregated analytics, heatmap, and dashboard stats.
"""

from datetime import datetime, timezone, timedelta
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from firebase_admin import firestore

from api.dependencies import CurrentUser, get_current_user

router = APIRouter()
db = firestore.client()


# ------------------------------------------------------------------ #
#  Helpers                                                            #
# ------------------------------------------------------------------ #

def _to_dt(val) -> Optional[datetime]:
    """Coerce Firestore timestamps, ISO strings, or None to datetime."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val).replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    try:
        return val.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _date_key(dt: Optional[datetime]) -> str:
    """Format datetime to 'Mon DD' string for chart labels."""
    if dt is None:
        return ""
    return dt.strftime("%b %d")


# ------------------------------------------------------------------ #
#  GET /analytics/{orgId}/summary                                     #
# ------------------------------------------------------------------ #

@router.get("/analytics/{org_id}/summary")
def analytics_summary(
    org_id: str,
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Returns aggregated analytics: total incidents, most active camera,
    most common threat, daily breakdown by threat type, threat distribution,
    avg response time per day, and per-camera stats.
    """
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    # Parse date range (default: last 30 days)
    now = datetime.now(timezone.utc)
    dt_from = now - timedelta(days=30)
    dt_to = now
    if dateFrom:
        try:
            dt_from = datetime.fromisoformat(dateFrom).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    if dateTo:
        try:
            dt_to = datetime.fromisoformat(dateTo).replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
        except ValueError:
            pass

    # Fetch all incidents for the org
    docs = list(
        db.collection("incidents")
        .document(org_id)
        .collection("items")
        .order_by("detectedAt", direction=firestore.Query.DESCENDING)
        .stream()
    )

    # Filter by date range
    incidents = []
    for d in docs:
        data = d.to_dict()
        detected = _to_dt(data.get("detectedAt"))
        if detected and dt_from <= detected <= dt_to:
            data["_id"] = d.id
            data["_detectedAt"] = detected
            incidents.append(data)

    total_incidents = len(incidents)

    # --- Most active camera ---
    camera_counts = defaultdict(int)
    for inc in incidents:
        camera_counts[inc.get("cameraId", "unknown")] += 1

    most_active_camera_id = max(camera_counts, key=camera_counts.get) if camera_counts else ""
    most_active_camera_name = most_active_camera_id
    if most_active_camera_id:
        cam_doc = (
            db.collection("cameras")
            .document(org_id)
            .collection("items")
            .document(most_active_camera_id)
            .get()
        )
        if cam_doc.exists:
            most_active_camera_name = cam_doc.to_dict().get("name", most_active_camera_id)

    # --- Most common threat ---
    threat_counts = defaultdict(int)
    for inc in incidents:
        threat_counts[inc.get("threatType", "Unknown")] += 1
    most_common_threat = max(threat_counts, key=threat_counts.get) if threat_counts else "—"

    # --- Best response time ---
    response_times = []
    for inc in incidents:
        detected = _to_dt(inc.get("detectedAt"))
        acked = _to_dt(inc.get("acknowledgedAt"))
        if detected and acked and acked > detected:
            response_times.append((acked - detected).total_seconds() / 60)
    best_response = round(min(response_times), 1) if response_times else 0

    # --- Daily breakdown by threat type (for BarChart) ---
    daily_threats = defaultdict(lambda: {"Fall": 0, "Chasing": 0, "Struggle": 0, "Zone": 0})
    for inc in incidents:
        day = _date_key(inc.get("_detectedAt"))
        tt = inc.get("threatType", "Zone")
        if tt in daily_threats[day]:
            daily_threats[day][tt] += 1
        else:
            daily_threats[day][tt] = daily_threats[day].get(tt, 0) + 1

    # Generate all days in range for continuity
    daily_breakdown = []
    d = dt_from.date()
    while d <= dt_to.date():
        key = datetime(d.year, d.month, d.day, tzinfo=timezone.utc).strftime("%b %d")
        entry = daily_threats.get(key, {"Fall": 0, "Chasing": 0, "Struggle": 0, "Zone": 0})
        daily_breakdown.append({"date": key, **entry})
        d += timedelta(days=1)

    # --- Threat distribution (for PieChart) ---
    threat_distribution = [
        {"name": k, "value": v}
        for k, v in sorted(threat_counts.items(), key=lambda x: -x[1])
    ]

    # --- Avg response time per day (for LineChart) ---
    daily_response = defaultdict(list)
    for inc in incidents:
        detected = _to_dt(inc.get("detectedAt"))
        acked = _to_dt(inc.get("acknowledgedAt"))
        if detected and acked and acked > detected:
            day = _date_key(detected)
            daily_response[day].append((acked - detected).total_seconds() / 60)

    avg_response_per_day = []
    d = dt_from.date()
    while d <= dt_to.date():
        key = datetime(d.year, d.month, d.day, tzinfo=timezone.utc).strftime("%b %d")
        times = daily_response.get(key, [])
        avg = round(sum(times) / len(times), 1) if times else 0
        avg_response_per_day.append({"date": key, "avgMinutes": avg})
        d += timedelta(days=1)

    # --- Per-camera stats ---
    per_camera = []
    for cam_id, count in camera_counts.items():
        cam_incidents = [i for i in incidents if i.get("cameraId") == cam_id]

        # False positive rate
        fp_count = sum(1 for i in cam_incidents if i.get("status") == "false_positive")
        fp_rate = round((fp_count / count) * 100, 1) if count > 0 else 0

        # Avg response time for this camera
        cam_response = []
        for inc in cam_incidents:
            detected = _to_dt(inc.get("detectedAt"))
            acked = _to_dt(inc.get("acknowledgedAt"))
            if detected and acked and acked > detected:
                cam_response.append((acked - detected).total_seconds() / 60)
        avg_rt = round(sum(cam_response) / len(cam_response), 1) if cam_response else 0

        # Resolve camera name
        cam_name = cam_id
        cam_doc = (
            db.collection("cameras")
            .document(org_id)
            .collection("items")
            .document(cam_id)
            .get()
        )
        if cam_doc.exists:
            cam_name = cam_doc.to_dict().get("name", cam_id)

        per_camera.append({
            "cameraName": cam_name,
            "totalIncidents": count,
            "falsePositiveRate": fp_rate,
            "avgResponseTime": avg_rt,
        })

    return {
        "totalIncidents": total_incidents,
        "mostActiveCamera": most_active_camera_name,
        "mostCommonThreat": most_common_threat,
        "bestResponseTimeMin": best_response,
        "dailyBreakdown": daily_breakdown if daily_breakdown else [],
        "threatDistribution": threat_distribution if threat_distribution else [],
        "avgResponsePerDay": avg_response_per_day if avg_response_per_day else [],
        "perCamera": per_camera if per_camera else [],
    }


# ------------------------------------------------------------------ #
#  GET /analytics/{orgId}/heatmap                                     #
# ------------------------------------------------------------------ #

@router.get("/analytics/{org_id}/heatmap")
def analytics_heatmap(
    org_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Per-camera incident counts for heat map visualisation."""
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    docs = (
        db.collection("incidents")
        .document(org_id)
        .collection("items")
        .stream()
    )

    camera_counts = defaultdict(int)
    for d in docs:
        data = d.to_dict()
        camera_counts[data.get("cameraId", "unknown")] += 1

    result = []
    for cam_id, count in camera_counts.items():
        cam_doc = (
            db.collection("cameras")
            .document(org_id)
            .collection("items")
            .document(cam_id)
            .get()
        )
        cam_name = cam_doc.to_dict().get("name", cam_id) if cam_doc.exists else cam_id
        result.append({
            "cameraId": cam_id,
            "cameraName": cam_name,
            "incidentCount": count,
        })

    result.sort(key=lambda x: -x["incidentCount"])
    return result if result else []


# ------------------------------------------------------------------ #
#  GET /dashboard/{orgId}/stats                                       #
# ------------------------------------------------------------------ #

@router.get("/dashboard/{org_id}/stats")
def dashboard_stats(
    org_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Four stat cards for the dashboard:
    - activeCameras: cameras with status='live'
    - alertsToday: incidents from last 24h
    - unacknowledged: incidents with status='alerted'
    - avgResponseTime: avg minutes between detectedAt and acknowledgedAt
    """
    if current_user.org_id != org_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorised.")

    # 1. Active cameras
    cameras = list(
        db.collection("cameras")
        .document(org_id)
        .collection("items")
        .where("status", "==", "live")
        .stream()
    )
    active_cameras = len(cameras)

    # 2. Alerts today + unacknowledged + response times
    now = datetime.now(timezone.utc)
    twenty_four_hours_ago = now - timedelta(hours=24)

    all_incidents = list(
        db.collection("incidents")
        .document(org_id)
        .collection("items")
        .stream()
    )

    alerts_today = 0
    unacknowledged = 0
    response_times = []

    for d in all_incidents:
        data = d.to_dict()
        detected = _to_dt(data.get("detectedAt"))

        # Count alerts from last 24h
        if detected and detected >= twenty_four_hours_ago:
            alerts_today += 1

        # Count unacknowledged
        if data.get("status") == "alerted":
            unacknowledged += 1

        # Collect response times
        acked = _to_dt(data.get("acknowledgedAt"))
        if detected and acked and acked > detected:
            response_times.append((acked - detected).total_seconds() / 60)

    avg_response = round(sum(response_times) / len(response_times), 1) if response_times else 0

    return {
        "activeCameras": active_cameras if active_cameras else 0,
        "alertsToday": alerts_today if alerts_today else 0,
        "unacknowledged": unacknowledged if unacknowledged else 0,
        "avgResponseTime": avg_response if avg_response else 0,
    }
