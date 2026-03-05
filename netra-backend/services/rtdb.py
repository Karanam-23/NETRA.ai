import time
from firebase_admin import db

def trigger_live_alert(org_id: str, incident_id: str, threat_type: str, 
                       camera_name: str, zone_name: str, confidence: float, snapshot_url: str):
    """
    Pushes a new real-time alert to the Firebase RTDB for dashboard clients.
    """
    # 1. Get reference to the specific org's live alerts node
    alerts_ref = db.reference(f'alerts/{org_id}/live')
    
    # 2. Generate a new unique key for this RTDB entry
    new_alert_ref = alerts_ref.push()
    
    # 3. Calculate timestamps (Current time and Expiry time: +5 minutes)
    current_time_ms = int(time.time() * 1000)
    expires_at_ms = current_time_ms + (5 * 60 * 1000)
    
    # 4. Construct the payload
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
    
    # 5. Write to RTDB
    new_alert_ref.set(alert_payload)
    
    print(f"[{org_id}] Live alert {new_alert_ref.key} pushed to RTDB successfully.")
    
    return new_alert_ref.key

def remove_live_alert(org_id: str, alert_id: str):
    """
    Removes the alert from RTDB (called when resolved or expired).
    """
    alert_ref = db.reference(f'alerts/{org_id}/live/{alert_id}')
    alert_ref.delete()
