from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.onboarding import OnboardingTaskStatus


class OnboardingTaskBase(BaseModel):
    task_name: str = Field(..., min_length=2, max_length=255)
    due_date: date


class OnboardingTaskCreate(OnboardingTaskBase):
    employee_id: int
    status: Optional[OnboardingTaskStatus] = OnboardingTaskStatus.PENDING


class OnboardingTaskUpdate(BaseModel):
    task_name: Optional[str] = Field(None, min_length=2, max_length=255)
    due_date: Optional[date] = None
    status: Optional[OnboardingTaskStatus] = None


class OnboardingTaskStatusUpdate(BaseModel):
    status: OnboardingTaskStatus


class OnboardingTaskResponse(OnboardingTaskBase):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    department: Optional[str] = None
    status: OnboardingTaskStatus
    is_overdue: bool = False
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OnboardingProgressResponse(BaseModel):
    employee_id: int
    employee_name: str
    department: str
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    overdue_tasks: int
    progress_percentage: float
    is_completed: bool
    tasks: List[OnboardingTaskResponse] = []

    model_config = ConfigDict(from_attributes=True)


class OnboardingSummaryResponse(BaseModel):
    total_assigned_tasks: int
    total_completed_tasks: int
    total_pending_tasks: int
    total_overdue_tasks: int
    overall_completion_rate: float
    employees_onboarding_count: int
    fully_onboarded_employees_count: int

    model_config = ConfigDict(from_attributes=True)

