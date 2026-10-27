from datetime import datetime
from typing import Dict, Optional
from pydantic import BaseModel, ConfigDict, Field

RATING_LABELS = {
    1: "Needs Improvement",
    2: "Below Expectations",
    3: "Meets Expectations",
    4: "Exceeds Expectations",
    5: "Exceptional",
}


class PerformanceReviewBase(BaseModel):
    review_period: str = Field(
        ...,
        pattern=r"^\d{4}-Q[1-4]$",
        description="Review period format YYYY-Q1 to YYYY-Q4 (e.g., 2026-Q3)",
    )
    rating: int = Field(
        ...,
        ge=1,
        le=5,
        description="Rating score between 1 and 5 inclusive",
    )
    feedback: str = Field(
        ...,
        min_length=5,
        max_length=5000,
        description="Constructive performance review feedback",
    )
    goals: Optional[str] = Field(
        None,
        max_length=5000,
        description="Future goals, milestones, or development targets",
    )


class PerformanceReviewCreate(PerformanceReviewBase):
    employee_id: int = Field(..., gt=0, description="Target employee ID")


class PerformanceReviewUpdate(BaseModel):
    review_period: Optional[str] = Field(
        None,
        pattern=r"^\d{4}-Q[1-4]$",
        description="Review period format YYYY-Q1 to YYYY-Q4",
    )
    rating: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="Rating score between 1 and 5 inclusive",
    )
    feedback: Optional[str] = Field(
        None,
        min_length=5,
        max_length=5000,
        description="Constructive performance review feedback",
    )
    goals: Optional[str] = Field(
        None,
        max_length=5000,
        description="Future goals, milestones, or development targets",
    )


class PerformanceReviewResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    employee_designation: Optional[str] = None
    employee_department: Optional[str] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_period: str
    rating: int
    rating_label: str
    feedback: str
    goals: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PerformanceSummary(BaseModel):
    total_reviews: int
    average_rating: float
    employees_reviewed: int
    rating_distribution: Dict[str, int]
    period_breakdown: Dict[str, int]

