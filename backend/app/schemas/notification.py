from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationType


class NotificationCreate(BaseModel):
    user_id: int
    title: str
    message: str
    type: NotificationType = NotificationType.SYSTEM
    link: Optional[str] = None


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: NotificationType
    is_read: bool
    link: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnreadCountResponse(BaseModel):
    unread_count: int


class MarkAllReadResponse(BaseModel):
    message: str
    updated_count: int


class NotificationSummary(BaseModel):
    total: int
    unread: int
    leave_count: int
    payroll_count: int
    attendance_count: int
    system_count: int


class NotificationBroadcast(BaseModel):
    title: str
    message: str
    type: NotificationType = NotificationType.SYSTEM
    target_role: Optional[str] = None  # ALL, EMPLOYEE, HR, ADMIN
    user_id: Optional[int] = None      # If target is specific user
    link: Optional[str] = None


