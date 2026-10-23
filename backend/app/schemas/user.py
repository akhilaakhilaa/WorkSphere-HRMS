from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    role: UserRole = UserRole.EMPLOYEE


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserAdminCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.EMPLOYEE
    is_active: bool = True
    employee_id: Optional[int] = None
    # Optional inline employee creation details
    create_employee: Optional[bool] = False
    full_name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    salary: Optional[Decimal] = None
    joining_date: Optional[date] = None


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6)
    employee_id: Optional[int] = None


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    username: Optional[str] = None
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    employee_id: Optional[int] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    employee_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserDetailResponse(UserResponse):
    attendance_records_count: int = 0
    leave_requests_count: int = 0
    payroll_records_count: int = 0
    notifications_count: int = 0
    can_delete: bool = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: int
    email: str
    username: Optional[str] = None
    employee_id: Optional[int] = None
    full_name: Optional[str] = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
