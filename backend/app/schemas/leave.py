from datetime import date, datetime
from decimal import Decimal
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


class LeavePolicyBase(BaseModel):
    leave_type: LeaveType
    total_days_allowed: Decimal = Field(..., ge=0)


class LeavePolicyCreate(LeavePolicyBase):
    pass


class LeavePolicyUpdate(BaseModel):
    total_days_allowed: Decimal = Field(..., ge=0)


class LeavePolicyResponse(BaseModel):
    id: int
    leave_type: LeaveType
    total_days_allowed: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaveBalanceResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    department: Optional[str] = None
    leave_type: LeaveType
    total_allowed: Decimal = Decimal("0.00")
    used_days: Decimal = Decimal("0.00")
    remaining_days: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaveBalanceInitRequest(BaseModel):
    employee_id: Optional[int] = None


class LeaveBalanceInitResponse(BaseModel):
    initialized_count: int
    message: str


# -------------------------------------------------------------
# Module 15: Leave Calendar, Team Availability & Conflict Schemas
# -------------------------------------------------------------


class LeaveCalendarItemResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    department: str
    designation: Optional[str] = None
    leave_type: LeaveType
    start_date: date
    end_date: date
    total_days: int
    status: LeaveStatus
    reason: Optional[str] = None
    is_confirmed: bool = True

    model_config = ConfigDict(from_attributes=True)


class TeamAvailabilityEmployee(BaseModel):
    employee_id: int
    employee_name: str
    department: str
    designation: Optional[str] = None
    leave_id: int
    leave_type: LeaveType
    start_date: date
    end_date: date
    total_days: int

    model_config = ConfigDict(from_attributes=True)


class DepartmentAvailabilitySummary(BaseModel):
    department: str
    total_active_employees: int
    employees_on_leave_today: int
    employees_not_on_leave_today: int
    coverage_rate_percentage: float


class TeamAvailabilityUpcoming(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    department: str
    leave_type: LeaveType
    start_date: date
    end_date: date
    total_days: int

    model_config = ConfigDict(from_attributes=True)


class TeamAvailabilityResponse(BaseModel):
    target_date: date
    total_active_employees: int
    employees_on_leave_today_count: int
    employees_not_on_leave_today_count: int
    on_leave_today: list[TeamAvailabilityEmployee]
    upcoming_leaves: list[TeamAvailabilityUpcoming]
    department_summaries: list[DepartmentAvailabilitySummary]


class ConflictEmployee(BaseModel):
    leave_id: int
    employee_id: int
    employee_name: str
    department: str
    leave_type: LeaveType
    status: LeaveStatus
    start_date: date
    end_date: date

    model_config = ConfigDict(from_attributes=True)


class LeaveConflictResponse(BaseModel):
    id: str
    department: str
    conflict_type: str
    severity: str  # HIGH, MEDIUM, LOW
    start_date: date
    end_date: date
    total_days_overlap: int
    employee_count: int
    employees: list[ConflictEmployee]
    message: str
    recommendation: str



