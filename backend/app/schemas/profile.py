from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    employee_id: Optional[int] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    joining_date: Optional[date] = None
    salary: Optional[float] = None
    status: Optional[str] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., min_length=6, max_length=128)


class NotificationPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    in_app_enabled: bool = True
    email_enabled: bool = True
    notify_leaves: bool = True
    notify_attendance: bool = True
    notify_tasks: bool = True
    notify_announcements: bool = True
    notify_payroll: bool = True


class NotificationPreferenceUpdate(BaseModel):
    in_app_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    notify_leaves: Optional[bool] = None
    notify_attendance: Optional[bool] = None
    notify_tasks: Optional[bool] = None
    notify_announcements: Optional[bool] = None
    notify_payroll: Optional[bool] = None

