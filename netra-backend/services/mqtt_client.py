import os
import time
import json
import logging
import paho.mqtt.publish as publish

logger = logging.getLogger(__name__)

MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST")
MQTT_BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", 1883))

def trigger_alarm(org_id: str, camera_id: str):
    """
    Publishes an alarm trigger event to the organization's MQTT topic.
    Subscribed hardware (e.g. Raspberry Pi attached to a siren) will pick this up instantly.
    """
    if not MQTT_BROKER_HOST:
        logger.warning(f"[{camera_id}] MQTT_BROKER_HOST not configured. Alarm skipped.")
        return
        
    # Topic matches PRD Section 14
    topic = f"netra/alarms/{org_id}/{camera_id}"
    
    payload = {
        "alarm": True,
        "timestamp": int(time.time()),
        "source": "Netra.AI Central",
        "command": "TRIGGER_SIREN"
    }
    
    try:
        # Use simple single-shot publish (connects, sends, disconnects)
        # Avoids maintaining a sticky connection inside the celery worker
        publish.single(
            topic=topic,
            payload=json.dumps(payload),
            hostname=MQTT_BROKER_HOST,
            port=MQTT_BROKER_PORT,
            # If using authentication for MQTT, add auth={'username':'x', 'password':'y'}
        )
        
        logger.info(f"[{camera_id}] Published MQTT Alarm payload to topic [ {topic} ]")
        
    except Exception as e:
        logger.error(f"[{camera_id}] Failed to publish MQTT alarm: {str(e)}")
