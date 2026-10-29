from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.resignation import ResignationStatus


class ResignationBase(BaseModel):
    reason: str = Field(..., min_length=5, max_length=2000, description="Reason for resignation")
    notice_period: int = Field(..., ge=1, le=180, description="Notice period in days (1 to 180)")

    @field_validator("reason")
    @classmethod
    def validate_reason_non_empty(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 5:
            raise ValueError("Resignation reason must be at least 5 characters long")
        return cleaned


class ResignationCreate(ResignationBase):
    employee_id: Optional[int] = None


class ResignationReview(BaseModel):
    status: ResignationStatus
    reviewer_comments: Optional[str] = Field(None, max_length=1000)
    last_working_day: Optional[date] = None

    @field_validator("status")
    @classmethod
    def validate_review_status(cls, v: ResignationStatus) -> ResignationStatus:
        if v not in (ResignationStatus.APPROVED, ResignationStatus.REJECTED):
            raise ValueError("Review status must be either APPROVED or REJECTED")
        return v


class ResignationResponse(ResignationBase):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department: Optional[str] = None
    status: ResignationStatus
    last_working_day: Optional[date] = None
    reviewed_by: Optional[int] = None
    reviewer_email: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewer_comments: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResignationSummary(BaseModel):
    total_requests: int
    pending: int
    approved: int
    rejected: int

