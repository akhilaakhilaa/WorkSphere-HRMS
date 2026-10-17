from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.EMPLOYEE


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    employee_id: Optional[int] = None
    full_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: int
    email: str
    employee_id: Optional[int] = None
    full_name: Optional[str] = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None

