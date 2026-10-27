from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.analytics_service import AnalyticsService
from app.database import get_db
from app.dependencies import require_roles
from app.models.employee import Employee
from app.models.user import User, UserRole
from app.schemas.advanced_analytics import (
    AnalyticsSummaryResponse,
    AttendanceTrendItem,
    DepartmentReportItem,
    LeaveTrendItem,
    PerformanceInsightsResponse,
)

router = APIRouter(prefix="/advanced-analytics", tags=["Advanced Analytics & Reports"])


def resolve_department(
    department: Optional[str] = None, department_id: Optional[str] = None
) -> Optional[str]:
    """Resolve department from either department or department_id parameter."""
    dept = department or department_id
    if dept and dept.strip().upper() == "ALL":
        return None
    return dept.strip() if dept and dept.strip() else None


# -------------------------------------------------------------
# 1. SUMMARY METRICS
# -------------------------------------------------------------
@router.get(
    "/summary",
    response_model=AnalyticsSummaryResponse,
    status_code=status.HTTP_200_OK,
)
def get_analytics_summary(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    department: Optional[str] = Query(None, description="Department name filter"),
    department_id: Optional[str] = Query(None, description="Alternative department parameter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Returns high-level organizational summary KPIs:
    - Active and total employee counts
    - Overall attendance rate and record breakdowns
    - Approved leave counts and total approved leave days
    - Average performance rating and evaluated employee count
    Restricted to HR and ADMIN roles.
    """
    resolved_dept = resolve_department(department, department_id)
    return AnalyticsService.get_summary(
        db=db,
        start_date=start_date,
        end_date=end_date,
        department=resolved_dept,
    )


# -------------------------------------------------------------
# 2. ATTENDANCE TRENDS
# -------------------------------------------------------------
@router.get(
    "/attendance-trends",
    response_model=List[AttendanceTrendItem],
    status_code=status.HTTP_200_OK,
)
def get_attendance_trends(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    department: Optional[str] = Query(None, description="Department name filter"),
    department_id: Optional[str] = Query(None, description="Alternative department parameter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Returns monthly attendance trends (Present, Half Day, Absent, Late, and calculated Rate).
    Restricted to HR and ADMIN roles.
    """
    resolved_dept = resolve_department(department, department_id)
    return AnalyticsService.get_attendance_trends(
        db=db,
        start_date=start_date,
        end_date=end_date,
        department=resolved_dept,
    )


# -------------------------------------------------------------
# 3. LEAVE TRENDS
# -------------------------------------------------------------
@router.get(
    "/leave-trends",
    response_model=List[LeaveTrendItem],
    status_code=status.HTTP_200_OK,
)
def get_leave_trends(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    department: Optional[str] = Query(None, description="Department name filter"),
    department_id: Optional[str] = Query(None, description="Alternative department parameter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Returns monthly leave trends (Submitted, Approved, Pending, Rejected, Cancelled, and Leave Days).
    Restricted to HR and ADMIN roles.
    """
    resolved_dept = resolve_department(department, department_id)
    return AnalyticsService.get_leave_trends(
        db=db,
        start_date=start_date,
        end_date=end_date,
        department=resolved_dept,
    )


# -------------------------------------------------------------
# 4. PERFORMANCE INSIGHTS
# -------------------------------------------------------------
@router.get(
    "/performance-insights",
    response_model=PerformanceInsightsResponse,
    status_code=status.HTTP_200_OK,
)
def get_performance_insights(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    department: Optional[str] = Query(None, description="Department name filter"),
    department_id: Optional[str] = Query(None, description="Alternative department parameter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Returns organizational performance insights:
    - Overall average rating
    - 1 to 5 star rating distribution
    - Department rating averages
    - Review period trend comparisons
    Restricted to HR and ADMIN roles.
    """
    resolved_dept = resolve_department(department, department_id)
    return AnalyticsService.get_performance_insights(
        db=db,
        start_date=start_date,
        end_date=end_date,
        department=resolved_dept,
    )


# -------------------------------------------------------------
# 5. DEPARTMENT COMPARATIVE REPORTS
# -------------------------------------------------------------
@router.get(
    "/department-reports",
    response_model=List[DepartmentReportItem],
    status_code=status.HTTP_200_OK,
)
def get_department_reports(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    department: Optional[str] = Query(None, description="Department name filter"),
    department_id: Optional[str] = Query(None, description="Alternative department parameter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Returns department-level breakdown comparing headcount, attendance rates,
    leave utilization, and performance averages.
    Restricted to HR and ADMIN roles.
    """
    resolved_dept = resolve_department(department, department_id)
    return AnalyticsService.get_department_reports(
        db=db,
        start_date=start_date,
        end_date=end_date,
        department=resolved_dept,
    )


# -------------------------------------------------------------
# 6. EXPORT DEPARTMENT REPORTS (CSV)
# -------------------------------------------------------------
@router.get(
    "/department-reports/export",
    status_code=status.HTTP_200_OK,
)
def export_department_reports_csv(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    department: Optional[str] = Query(None, description="Department name filter"),
    department_id: Optional[str] = Query(None, description="Alternative department parameter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Exports filtered department comparative metrics as a downloadable CSV.
    Safely sanitizes output fields and attaches formatted timestamp.
    Restricted to HR and ADMIN roles.
    """
    resolved_dept = resolve_department(department, department_id)
    csv_content = AnalyticsService.export_department_reports_csv(
        db=db,
        start_date=start_date,
        end_date=end_date,
        department=resolved_dept,
    )

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"WorkSphere_Department_Report_{timestamp}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


# -------------------------------------------------------------
# 7. DISTINCT DEPARTMENTS LIST
# -------------------------------------------------------------
@router.get(
    "/departments",
    response_model=List[str],
    status_code=status.HTTP_200_OK,
)
def get_available_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Returns distinct list of active department names for filtering.
    Restricted to HR and ADMIN roles.
    """
    dept_rows = (
        db.query(Employee.department)
        .filter(Employee.department.isnot(None), Employee.department != "")
        .distinct()
        .all()
    )
    return sorted([r[0] for r in dept_rows if r[0]])

