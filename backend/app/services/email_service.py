"""
Email Service for WorkSphere HRMS
Module 25: Third-Party Integrations
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional

from app.config import (
    EMAIL_DEV_MODE,
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_TLS,
    SMTP_USER,
)

logger = logging.getLogger("worksphere.email_service")


def send_email(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
) -> bool:
    """
    Sends an email using SMTP or simulates delivery in development mode.
    Guaranteed not to crash caller transactions on failure.
    """
    if not to_email:
        logger.warning("[Email] Missing recipient email address.")
        return False

    if EMAIL_DEV_MODE:
        logger.info(
            f"[EMAIL DEV MODE] Simulated delivery to: {to_email} | Subject: {subject} | Body: {body_text[:100]}..."
        )
        return True

    if not SMTP_HOST or not SMTP_PORT:
        logger.error("[Email] SMTP configuration incomplete. Email delivery skipped.")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email

        part1 = MIMEText(body_text, "plain", "utf-8")
        msg.attach(part1)

        if body_html:
            part2 = MIMEText(body_html, "html", "utf-8")
            msg.attach(part2)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            if SMTP_TLS:
                server.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to_email], msg.as_string())

        logger.info(f"[Email] Successfully sent email to {to_email}")
        return True

    except Exception as exc:
        logger.error(f"[Email] Failed to deliver email to {to_email}: {exc}")
        return False


def get_email_status() -> Dict[str, Any]:
    """
    Returns non-sensitive SMTP integration status.
    Guarantees no credentials or passwords are leaked.
    """
    is_configured = bool(SMTP_HOST and SMTP_PORT and (SMTP_USER or EMAIL_DEV_MODE))
    return {
        "status": "ready" if is_configured else "unconfigured",
        "configured": is_configured,
        "host": SMTP_HOST,
        "port": SMTP_PORT,
        "tls": SMTP_TLS,
        "dev_mode": EMAIL_DEV_MODE,
        "from_address": SMTP_FROM,
    }

