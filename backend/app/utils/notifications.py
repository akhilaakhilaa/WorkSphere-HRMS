from typing import Optional
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole


def notify_user(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notif_type: NotificationType = NotificationType.SYSTEM,
    link: Optional[str] = None,
):
    """Creates a notification record for a specific user."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        is_read=False,
        link=link,
    )
    db.add(notif)


def notify_admins_and_hr(
    db: Session,
    title: str,
    message: str,
    notif_type: NotificationType = NotificationType.SYSTEM,
    link: Optional[str] = None,
):
    """Dispatches a notification to all ADMIN and HR users."""
    admins_and_hrs = (
        db.query(User)
        .filter(User.role.in_([UserRole.ADMIN, UserRole.HR]), User.is_active == True)
        .all()
    )
    for u in admins_and_hrs:
        notif = Notification(
            user_id=u.id,
            title=title,
            message=message,
            type=notif_type,
            is_read=False,
            link=link,
        )
        db.add(notif)


def notify_all_users(
    db: Session,
    title: str,
    message: str,
    notif_type: NotificationType = NotificationType.SYSTEM,
    target_role: Optional[UserRole] = None,
    link: Optional[str] = None,
) -> int:
    """Dispatches a notification to all active users or users of a specific role."""
    query = db.query(User).filter(User.is_active == True)
    if target_role:
        query = query.filter(User.role == target_role)
    users = query.all()
    for u in users:
        notif = Notification(
            user_id=u.id,
            title=title,
            message=message,
            type=notif_type,
            is_read=False,
            link=link,
        )
        db.add(notif)
    return len(users)


