from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ActivityItem(BaseModel):
    id: str
    type: str  # ATTENDANCE, LEAVE, PAYROLL, EMPLOYEE
    title: str
    description: str
    timestamp: str
    status: Optional[str] = None


class DepartmentStat(BaseModel):
    department: str
    employee_count: int
    total_payroll: Decimal
    active_count: int


class DashboardKPIs(BaseModel):
    total_employees: int
    active_employees: int
    departments_count: int
    today_attendance: Dict[str, Any]
    leaves_kpi: Dict[str, Any]
    payroll_kpi: Dict[str, Any]


class DashboardAnalytics(BaseModel):
    kpis: DashboardKPIs
    department_distribution: List[DepartmentStat]
    attendance_breakdown: Dict[str, int]
    leave_types_breakdown: Dict[str, int]
    monthly_payroll_trend: List[Dict[str, Any]]
    recent_activities: List[ActivityItem]


class EmployeePersonalDashboard(BaseModel):
    employee_id: int
    full_name: str
    designation: str
    department: str
    today_attendance: Optional[Dict[str, Any]]
    attendance_stats: Dict[str, Any]
    leave_stats: Dict[str, Any]
    latest_payslip: Optional[Dict[str, Any]]

