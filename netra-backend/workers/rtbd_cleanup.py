import time
from firebase_admin import db
from workers.celery_app import celery_app

@celery_app.task
def cleanup_stale_alerts():
    """
    Scans all orgs in RTDB and deletes live alerts past their expiresAt timestamp.
    """
    current_time_ms = int(time.time() * 1000)
    alerts_ref = db.reference('alerts')
    
    # Fetch the entire alerts tree (orgIds are the top-level keys)
    # Note: In production at huge scale, querying by index is better, but this works 
    # perfectly for the MVP since live queues per org are small (<= 5 min retention).
    all_orgs_data = alerts_ref.get()
    
    if not all_orgs_data:
        return "No alerts node found."
        
    deleted_count = 0
    
    for org_id, org_data in all_orgs_data.items():
         if 'live' in org_data:
             live_alerts = org_data['live']
             for alert_id, alert_data in live_alerts.items():
                 # Handle missing expiresAt gracefully
                 expires_at = alert_data.get('expiresAt', 0)
                 
                 if expires_at < current_time_ms:
                     # Delete the stale alert
                     db.reference(f'alerts/{org_id}/live/{alert_id}').delete()
                     deleted_count += 1
                     print(f"[{org_id}] Cleaned up stale RTDB alert {alert_id}")
                     
    return f"Cleaned up {deleted_count} stale alerts."
