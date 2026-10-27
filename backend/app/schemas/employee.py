from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.employee import EmployeeStatus


class EmployeeBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    designation: str = Field(..., min_length=2, max_length=100)
    department: str = Field(..., min_length=2, max_length=100)
    joining_date: date
    salary: Decimal = Field(..., ge=0)
    status: EmployeeStatus = EmployeeStatus.ACTIVE


class EmployeeCreate(EmployeeBase):
    user_id: Optional[int] = None
    create_user_account: Optional[bool] = False
    user_email: Optional[str] = None
    user_password: Optional[str] = None


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    designation: Optional[str] = Field(None, min_length=2, max_length=100)
    department: Optional[str] = Field(None, min_length=2, max_length=100)
    joining_date: Optional[date] = None
    salary: Optional[Decimal] = Field(None, ge=0)
    status: Optional[EmployeeStatus] = None
    user_id: Optional[int] = None


class EmployeeResponse(EmployeeBase):
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    role: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeSearchItemResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    full_name: str
    designation: str
    department: str
    role: Optional[str] = None
    status: EmployeeStatus
    joining_date: date
    salary: Optional[Decimal] = None
    attendance_status: Optional[str] = None
    is_late: Optional[bool] = False
    performance_rating: Optional[float] = None
    performance_level: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeSearchPaginationResponse(BaseModel):
    items: list[EmployeeSearchItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


