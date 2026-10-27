from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, model_validator

from app.models.notification import NotificationType


class NotificationCreate(BaseModel):
    user_id: Optional[int] = None
    recipient_id: Optional[int] = None
    title: str
    message: str
    type: NotificationType = NotificationType.SYSTEM
    link: Optional[str] = None
    related_entity_id: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_recipient(cls, data):
        if isinstance(data, dict):
            if "recipient_id" in data and "user_id" not in data:
                data["user_id"] = data["recipient_id"]
            elif "user_id" in data and "recipient_id" not in data:
                data["recipient_id"] = data["user_id"]
        return data


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    recipient_id: Optional[int] = None
    title: str
    message: str
    type: NotificationType
    notification_type: Optional[NotificationType] = None
    is_read: bool
    link: Optional[str] = None
    related_entity_id: Optional[int] = None
    created_at: datetime
    read_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def sync_aliases(self):
        if self.recipient_id is None:
            self.recipient_id = self.user_id
        if self.notification_type is None:
            self.notification_type = self.type
        return self


class UnreadCountResponse(BaseModel):
    unread_count: int


class MarkAllReadResponse(BaseModel):
    message: str
    updated_count: int


class NotificationDeleteResponse(BaseModel):
    message: str
    notification_id: int


class NotificationSummary(BaseModel):
    total: int
    unread: int
    leave_count: int
    payroll_count: int
    attendance_count: int
    system_count: int
    document_count: int = 0
    performance_count: int = 0


class NotificationBroadcast(BaseModel):
    title: str
    message: str
    type: NotificationType = NotificationType.SYSTEM
    target_role: Optional[str] = None  # ALL, EMPLOYEE, HR, ADMIN
    user_id: Optional[int] = None      # If target is specific user
    link: Optional[str] = None
    related_entity_id: Optional[int] = None
