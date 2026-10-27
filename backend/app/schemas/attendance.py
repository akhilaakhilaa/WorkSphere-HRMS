from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict

from app.models.attendance import AttendanceStatus


class CheckInRequest(BaseModel):
    notes: Optional[str] = None


class CheckOutRequest(BaseModel):
    notes: Optional[str] = None


class AttendanceManualRecord(BaseModel):
    employee_id: int
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    working_hours: Optional[Decimal] = None
    overtime_hours: Decimal = Decimal("0.00")
    status: AttendanceStatus = AttendanceStatus.PRESENT
    notes: Optional[str] = None


class AttendanceUpdate(BaseModel):
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    working_hours: Optional[Decimal] = None
    overtime_hours: Optional[Decimal] = None
    status: Optional[AttendanceStatus] = None
    notes: Optional[str] = None


class AttendanceResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    shift_id: Optional[int] = None
    shift_name: Optional[str] = None
    scheduled_start: Optional[time] = None
    scheduled_end: Optional[time] = None
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    working_hours: Optional[Decimal] = None
    overtime_hours: Decimal = Decimal("0.00")
    status: AttendanceStatus
    is_late: bool = False
    late_minutes: int = 0
    is_early_departure: bool = False
    early_departure_minutes: int = 0
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttendanceSummary(BaseModel):
    total_records: int
    present_days: int
    half_days: int
    absent_days: int
    total_hours: Decimal
    total_overtime_hours: Decimal = Decimal("0.00")


class AutoAbsentResponse(BaseModel):
    target_date: date
    dry_run: bool
    marked_count: int
    marked_absent_count: int = 0
    message: str
    total_employees_evaluated: int = 0
    skipped_already_logged: int = 0
    skipped_on_leave: int = 0
    skipped_non_workday: bool = False


