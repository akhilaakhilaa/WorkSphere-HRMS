from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class FeedbackCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000, description="Feedback comment")
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")


class FeedbackEmployeeInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    department: Optional[str] = None
    designation: Optional[str] = None


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    employee: Optional[FeedbackEmployeeInfo] = None
    message: str
    rating: int
    created_at: datetime


class RatingCount(BaseModel):
    rating: int
    count: int


class FeedbackSummary(BaseModel):
    total_feedback: int
    average_rating: float
    rating_breakdown: List[RatingCount]

