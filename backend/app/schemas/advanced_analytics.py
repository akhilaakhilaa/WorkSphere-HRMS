from datetime import date
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AnalyticsSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    active_employees: int = Field(..., description="Number of active employees in scope")
    total_employees: int = Field(..., description="Total employees in scope")
    attendance_rate: Optional[float] = Field(None, description="Attendance rate percentage or null if no records")
    total_attendance_records: int = Field(0, description="Total attendance records in scope")
    present_records: int = Field(0, description="Records marked PRESENT")
    half_day_records: int = Field(0, description="Records marked HALF_DAY")
    absent_records: int = Field(0, description="Records marked ABSENT")
    late_records: int = Field(0, description="Records with late arrival")
    approved_leaves: int = Field(0, description="Count of approved leave requests in scope")
    approved_leave_days: float = Field(0.0, description="Total days for approved leave requests")
    average_performance_rating: Optional[float] = Field(None, description="Average performance rating or null if no reviews")
    evaluated_employees: int = Field(0, description="Distinct count of employees with reviews")
    total_performance_reviews: int = Field(0, description="Total performance reviews in scope")


class AttendanceTrendItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    month: str = Field(..., description="Month in YYYY-MM format")
    present_count: int = Field(0, description="Number of present days")
    half_day_count: int = Field(0, description="Number of half days")
    absent_count: int = Field(0, description="Number of absent days")
    late_count: int = Field(0, description="Number of late arrivals")
    total_records: int = Field(0, description="Total attendance records for the month")
    attendance_rate: Optional[float] = Field(None, description="Monthly attendance rate percentage or null")


class LeaveTrendItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    month: str = Field(..., description="Month in YYYY-MM format")
    submitted_count: int = Field(0, description="Total leave requests submitted in the month")
    approved_count: int = Field(0, description="Approved leave requests")
    pending_count: int = Field(0, description="Pending leave requests")
    rejected_count: int = Field(0, description="Rejected leave requests")
    cancelled_count: int = Field(0, description="Cancelled leave requests")
    approved_leave_days: float = Field(0.0, description="Total approved leave days in the month")


class PerformanceInsightsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    average_rating: Optional[float] = Field(None, description="Overall average rating in scope")
    employees_evaluated: int = Field(0, description="Count of distinct evaluated employees")
    total_reviews: int = Field(0, description="Total review records in scope")
    rating_distribution: Dict[str, int] = Field(default_factory=dict, description="Count of reviews per rating (1-5)")
    by_department: Dict[str, Optional[float]] = Field(default_factory=dict, description="Average rating by department")
    by_period: Dict[str, Optional[float]] = Field(default_factory=dict, description="Average rating by review period")


class DepartmentReportItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    department: str = Field(..., description="Department name")
    active_employees: int = Field(0, description="Active employees in department")
    total_employees: int = Field(0, description="Total employees in department")
    attendance_records: int = Field(0, description="Attendance records in scope")
    attendance_rate: Optional[float] = Field(None, description="Department attendance rate percentage")
    leave_requests: int = Field(0, description="Total leave requests in scope")
    approved_leaves: int = Field(0, description="Approved leave requests in scope")
    approved_leave_days: float = Field(0.0, description="Approved leave days in scope")
    evaluated_employees: int = Field(0, description="Distinct evaluated employees")
    total_reviews: int = Field(0, description="Total reviews in scope")
    average_rating: Optional[float] = Field(None, description="Average performance rating")

