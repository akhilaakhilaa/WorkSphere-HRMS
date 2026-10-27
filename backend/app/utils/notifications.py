"""
Smart Notifications & Alerts Utility
WorkSphere HRMS Module 19

Provides unified dispatching and intelligent de-duplication for automated
attendance, leave, payroll, and organizational alerts.
"""

from datetime import date, datetime
import logging
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole

logger = logging.getLogger("worksphere.notifications")


def notify_user(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notif_type: NotificationType = NotificationType.SYSTEM,
    link: Optional[str] = None,
    related_entity_id: Optional[int] = None,
    prevent_duplicate: bool = True,
) -> Optional[Notification]:
    """
    Creates a notification record for a specific recipient user.
    Includes smart deduplication to prevent repetitive notifications for
    the same business event or entity.
    """
    try:
        if prevent_duplicate:
            dup_query = db.query(Notification).filter(
                Notification.user_id == user_id,
                Notification.type == notif_type,
                Notification.title == title,
            )
            if related_entity_id is not None:
                dup_query = dup_query.filter(Notification.related_entity_id == related_entity_id)
            else:
                dup_query = dup_query.filter(Notification.message == message)

            existing = dup_query.first()
            if existing:
                logger.info(
                    f"[Notifications] Skipped duplicate alert for user {user_id}: {title} (Entity: {related_entity_id})"
                )
                return existing

        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notif_type,
            is_read=False,
            link=link,
            related_entity_id=related_entity_id,
        )
        db.add(notif)
        return notif
    except Exception as e:
        logger.error(f"[Notifications] Failed to create notification for user {user_id}: {e}")
        return None


def notify_admins_and_hr(
    db: Session,
    title: str,
    message: str,
    notif_type: NotificationType = NotificationType.SYSTEM,
    link: Optional[str] = None,
    related_entity_id: Optional[int] = None,
    prevent_duplicate: bool = True,
) -> List[Notification]:
    """Dispatches a notification to all active ADMIN and HR users with deduplication."""
    admins_and_hrs = (
        db.query(User)
        .filter(User.role.in_([UserRole.ADMIN, UserRole.HR]), User.is_active == True)
        .all()
    )
    created_notifs = []
    for u in admins_and_hrs:
        n = notify_user(
            db=db,
            user_id=u.id,
            title=title,
            message=message,
            notif_type=notif_type,
            link=link,
            related_entity_id=related_entity_id,
            prevent_duplicate=prevent_duplicate,
        )
        if n:
            created_notifs.append(n)
    return created_notifs


def notify_all_users(
    db: Session,
    title: str,
    message: str,
    notif_type: NotificationType = NotificationType.SYSTEM,
    target_role: Optional[UserRole] = None,
    link: Optional[str] = None,
    related_entity_id: Optional[int] = None,
) -> int:
    """Dispatches a notification to all active users or users of a specific role."""
    query = db.query(User).filter(User.is_active == True)
    if target_role:
        query = query.filter(User.role == target_role)
    users = query.all()
    count = 0
    for u in users:
        n = notify_user(
            db=db,
            user_id=u.id,
            title=title,
            message=message,
            notif_type=notif_type,
            link=link,
            related_entity_id=related_entity_id,
            prevent_duplicate=False,
        )
        if n:
            count += 1
    return count


def check_document_expiry_support() -> Dict[str, object]:
    """
    Document Expiry Inspection:
    Inspects whether the Document model supports expiration dates.
    As per Module 16 and Module 19 requirements, if no expiry date field exists,
    do not invent fake fields or values; document the limitation safely.
    """
    return {
        "supported": False,
        "reason": "Document model does not contain an expiry date field.",
        "warning_days": 30,
        "alerts_generated": 0,
        "status": "DISABLED_SCHEMA_LIMITATION",
    }
