from datetime import date, datetime, time
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ShiftBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    start_time: time
    end_time: time
    description: Optional[str] = None
    grace_period_minutes: int = Field(default=15, ge=0, le=120)

    @model_validator(mode="after")
    def validate_times(self):
        if self.start_time == self.end_time:
            raise ValueError("Shift start_time and end_time cannot be identical")
        return self


class ShiftCreate(ShiftBase):
    pass


class ShiftUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    description: Optional[str] = None
    grace_period_minutes: Optional[int] = Field(None, ge=0, le=120)

    @model_validator(mode="after")
    def validate_times(self):
        if self.start_time is not None and self.end_time is not None:
            if self.start_time == self.end_time:
                raise ValueError("Shift start_time and end_time cannot be identical")
        return self


class ShiftResponse(ShiftBase):
    id: int
    is_overnight: bool
    created_at: datetime
    updated_at: datetime
    active_employees_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class EmployeeShiftAssignRequest(BaseModel):
    employee_id: int
    shift_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("Assignment end_date cannot be earlier than start_date")
        return self


class EmployeeShiftUpdateRequest(BaseModel):
    shift_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("Assignment end_date cannot be earlier than start_date")
        return self


class EmployeeShiftResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    shift_id: int
    shift_name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_overnight: bool = False
    grace_period_minutes: int = 15
    start_date: date
    end_date: Optional[date] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

