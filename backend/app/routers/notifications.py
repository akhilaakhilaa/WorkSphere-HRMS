from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole
from app.schemas.notification import (
    MarkAllReadResponse,
    NotificationBroadcast,
    NotificationResponse,
    NotificationSummary,
    UnreadCountResponse,
)
from app.utils.notifications import notify_all_users, notify_user

router = APIRouter(prefix="/notifications", tags=["Module 7: Notifications"])


@router.get("", response_model=List[NotificationResponse])
def get_my_notifications(
    unread_only: bool = Query(False, description="Filter only unread notifications"),
    notif_type: Optional[NotificationType] = Query(None, alias="type", description="Filter by category"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns recent notifications for current authenticated user.
    Enforces authentication: users can access only their own notifications.
    Supports filtering by unread state and notification category.
    """
    query = db.query(Notification).filter(Notification.user_id == current_user.id)

    if unread_only:
        query = query.filter(Notification.is_read == False)

    if notif_type:
        query = query.filter(Notification.type == notif_type)

    notifications = query.order_by(Notification.id.desc()).offset(skip).limit(limit).all()
    return notifications


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the count of unread notifications for the current authenticated user.
    Used for notification bell badge count.
    """
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )
    return UnreadCountResponse(unread_count=count)


@router.get("/summary", response_model=NotificationSummary)
def get_notification_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns high-level summary metrics for the notification center.
    """
    user_notifs = db.query(Notification).filter(Notification.user_id == current_user.id).all()
    total = len(user_notifs)
    unread = sum(1 for n in user_notifs if not n.is_read)
    leave_count = sum(1 for n in user_notifs if n.type == NotificationType.LEAVE)
    payroll_count = sum(1 for n in user_notifs if n.type == NotificationType.PAYROLL)
    attendance_count = sum(1 for n in user_notifs if n.type == NotificationType.ATTENDANCE)
    system_count = sum(1 for n in user_notifs if n.type == NotificationType.SYSTEM)

    return NotificationSummary(
        total=total,
        unread=unread,
        leave_count=leave_count,
        payroll_count=payroll_count,
        attendance_count=attendance_count,
        system_count=system_count,
    )


@router.put("/read-all", response_model=MarkAllReadResponse)
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Marks all unread notifications for current authenticated user as read.
    """
    unread_records = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .all()
    )
    count = len(unread_records)
    for n in unread_records:
        n.is_read = True

    db.commit()
    return MarkAllReadResponse(
        message="All notifications marked as read",
        updated_count=count,
    )


@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Marks a specific notification as read.
    Enforces security: user can only mark their own notification.
    """
    notif = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/broadcast", status_code=status.HTTP_201_CREATED)
def broadcast_organization_alert(
    broadcast: NotificationBroadcast,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    HR and ADMIN dispatch organization alerts or announcements to employees.
    """
    target_role_enum = None
    if broadcast.target_role and broadcast.target_role.upper() != "ALL":
        try:
            target_role_enum = UserRole(broadcast.target_role.upper())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid target role: {broadcast.target_role}",
            )

    if broadcast.user_id:
        target_user = db.query(User).filter(User.id == broadcast.user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target user #{broadcast.user_id} not found",
            )
        notify_user(
            db,
            user_id=target_user.id,
            title=broadcast.title,
            message=broadcast.message,
            notif_type=broadcast.type,
            link=broadcast.link,
        )
        db.commit()
        return {
            "message": "Direct notification sent successfully",
            "recipients_count": 1,
        }
    else:
        sent_count = notify_all_users(
            db,
            title=broadcast.title,
            message=broadcast.message,
            notif_type=broadcast.type,
            target_role=target_role_enum,
            link=broadcast.link,
        )
        db.commit()
        return {
            "message": "Organization alert broadcasted successfully",
            "recipients_count": sent_count,
        }

