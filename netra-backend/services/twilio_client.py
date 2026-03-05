import os
import logging
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

logger = logging.getLogger(__name__)

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER")
TWILIO_TO_NUMBER = os.getenv("TWILIO_TO_NUMBER")

# Instantiate singleton client
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
else:
    client = None
    logger.warning("Twilio credentials missing. SMS functionality will be disabled.")

def send_sms(to: str, body: str) -> bool:
    """Dispatches a text message via Twilio."""
    if not client:
        logger.error(f"Cannot send SMS to {to}: Twilio client not initialized.")
        return False
        
    try:
        message = client.messages.create(
            body=body,
            from_=TWILIO_FROM_NUMBER,
            to=to
        )
        logger.info(f"Twilio SMS dispatched. SID: {message.sid}")
        return True
        
    except TwilioRestException as e:
        logger.error(f"Twilio API Error while sending to {to}: {e.msg}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error while sending SMS to {to}: {str(e)}")
        return False


def send_sms_to_default(body: str) -> bool:
    """Sends SMS to the default TWILIO_TO_NUMBER from .env."""
    if not TWILIO_TO_NUMBER:
        logger.error("TWILIO_TO_NUMBER not set in .env. Cannot send SMS.")
        return False
    return send_sms(to=TWILIO_TO_NUMBER, body=body)

