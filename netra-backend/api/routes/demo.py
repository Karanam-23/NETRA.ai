"""
Public demo endpoint — sends a real SMS alert via Twilio.
Reads all credentials + the recipient number from .env.
No Firebase auth required.
"""

import os
import logging
from fastapi import APIRouter
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

load_dotenv()
logger = logging.getLogger(__name__)

router = APIRouter()

# ---------- Twilio config from .env ----------
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER")
TWILIO_TO_NUMBER = os.getenv("TWILIO_TO_NUMBER")

if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
else:
    twilio_client = None
    logger.warning("Twilio credentials missing — demo SMS will not work.")


# ---------- Request schema ----------
class DemoAlertSmsRequest(BaseModel):
    threat: str = Field(..., description="Threat type, e.g. Chasing")
    camera: str = Field(..., description="Camera label, e.g. CAM 01 — Main Gate")
    confidence: int = Field(..., ge=0, le=100, description="Confidence percentage")
    time: str = Field(..., description="Detection timestamp, e.g. 14:23:05")


# ---------- Endpoint ----------
@router.post("/demo/send-alert-sms")
def demo_send_alert_sms(req: DemoAlertSmsRequest):
    """Send a demo alert SMS to the pre-configured TWILIO_TO_NUMBER."""

    if not twilio_client:
        return {"success": False, "error": "Twilio client not initialized. Check .env credentials."}

    if not TWILIO_TO_NUMBER:
        return {"success": False, "error": "TWILIO_TO_NUMBER not set in .env."}

    body = (
        f"NETRA.AI DEMO ALERT\n"
        f"Threat: {req.threat}\n"
        f"Camera: {req.camera}\n"
        f"Confidence: {req.confidence}%\n"
        f"Time: {req.time}\n"
        f"This is a demo simulation."
    )

    try:
        message = twilio_client.messages.create(
            body=body,
            from_=TWILIO_FROM_NUMBER,
            to=TWILIO_TO_NUMBER,
        )
        logger.info(f"Demo SMS sent. SID: {message.sid}")
        return {"success": True, "sid": message.sid}

    except TwilioRestException as e:
        logger.error(f"Twilio API error: {e.msg}")
        return {"success": False, "error": str(e.msg)}
    except Exception as e:
        logger.error(f"Unexpected error sending demo SMS: {e}")
        return {"success": False, "error": str(e)}
