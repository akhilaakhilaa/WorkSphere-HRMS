from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.leave import LeaveStatus, LeaveType


class LeaveBase(BaseModel):
    leave_type: LeaveType = LeaveType.CASUAL
    start_date: date
    end_date: date
    reason: str = Field(..., min_length=3, max_length=1000)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be greater than or equal to start_date")
        return self


class LeaveCreate(LeaveBase):
    pass


class LeaveReview(BaseModel):
    status: LeaveStatus  # APPROVED or REJECTED
    admin_remarks: Optional[str] = Field(None, max_length=500)


class LeaveResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    department: Optional[str] = None
    leave_type: LeaveType
    start_date: date
    end_date: date
    total_days: int
    reason: str
    status: LeaveStatus
    admin_remarks: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewer_email: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaveSummary(BaseModel):
    total_requests: int
    pending: int
    approved: int
    rejected: int
    cancelled: int

