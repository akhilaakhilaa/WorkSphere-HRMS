from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.task import TaskStatus


class TaskBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255, description="Title of the task")
    description: Optional[str] = Field(None, max_length=5000, description="Task details/instructions")
    due_date: date = Field(..., description="Target completion due date")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Task title must be at least 2 characters long")
        return cleaned


class TaskCreate(TaskBase):
    assigned_to: int = Field(..., description="ID of the assigned employee (employees.id)")


class TaskUpdate(BaseModel):
    assigned_to: Optional[int] = None
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    due_date: Optional[date] = None
    status: Optional[TaskStatus] = None

    @field_validator("title")
    @classmethod
    def validate_optional_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            if len(cleaned) < 2:
                raise ValueError("Task title must be at least 2 characters long")
            return cleaned
        return v


class TaskStatusUpdate(BaseModel):
    status: TaskStatus = Field(..., description="Updated status: PENDING or COMPLETED")


class TaskResponse(TaskBase):
    id: int
    assigned_to: int
    assigned_employee_name: Optional[str] = None
    assigned_employee_code: Optional[str] = None
    department: Optional[str] = None
    status: TaskStatus
    is_overdue: bool = False
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskSummary(BaseModel):
    total_tasks: int
    pending_tasks: int
    completed_tasks: int
    overdue_tasks: int

