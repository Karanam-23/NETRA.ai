"""
Public demo endpoint that sends an SMS alert to the pre-configured
TWILIO_TO_NUMBER from .env.  No phone input needed from the frontend.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from services.twilio_client import send_sms_to_default

router = APIRouter()


class DemoAlertSmsRequest(BaseModel):
    threat: str = Field(..., description="Threat type, e.g. Chasing")
    camera: str = Field(..., description="Camera label, e.g. CAM 01 -- Main Gate")
    confidence: int = Field(..., ge=0, le=100, description="Confidence percentage")
    time: str = Field(..., description="Time string when the threat was detected")


@router.post("/demo/send-alert-sms")
def demo_send_alert_sms(req: DemoAlertSmsRequest):
    body = (
        f"NETRA.AI DEMO ALERT: {req.threat} detected at {req.camera}. "
        f"Confidence: {req.confidence}%. Time: {req.time}. "
        f"Location: Saveetha University Campus. Please respond immediately."
    )
    ok = send_sms_to_default(body)
    if ok:
        return {"success": True}
    return {"success": False, "error": "Failed to send SMS. Check server logs for details."}
