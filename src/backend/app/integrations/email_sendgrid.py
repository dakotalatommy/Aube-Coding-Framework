from typing import Dict, Any


def sendgrid_send_email(to_email: str, subject: str, body_html: str) -> Dict[str, Any]:
    # placeholder: wire httpx to SendGrid Mail Send API
    # returns a stubbed success
    return {"status": "queued", "provider_id": "sendgrid-stub"}


