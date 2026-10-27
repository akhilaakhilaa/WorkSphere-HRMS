"""
Analytics Service for WorkSphere HRMS Module 18: Advanced Analytics & Reports.
Provides organizational calculations, trend aggregations, performance insights,
department comparisons, and CSV export using existing database models.
"""

import csv
import io
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.leave import Leave, LeaveStatus
from app.models.performance import PerformanceReview
from app.schemas.advanced_analytics import (
    AnalyticsSummaryResponse,
    AttendanceTrendItem,
    DepartmentReportItem,
    LeaveTrendItem,
    PerformanceInsightsResponse,
)


def validate_date_range(start_date: Optional[date], end_date: Optional[date]) -> None:
    """Validate that start_date is not after end_date."""
    if start_date is not None and end_date is not None:
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date must be less than or equal to end_date",
            )


def generate_month_range(
    start: Optional[date], end: Optional[date], default_months: int = 6
) -> List[str]:
    """Generate an ordered list of YYYY-MM month strings covering the date interval."""
    today = date.today()
    target_end = end or today

    if start is None:
        year = target_end.year
        month = target_end.month - (default_months - 1)
        while month <= 0:
            month += 12
            year -= 1
        target_start = date(year, month, 1)
    else:
        target_start = start

    cur_year = target_start.year
    cur_month = target_start.month
    end_year = target_end.year
    end_month = target_end.month

    months = []
    while (cur_year < end_year) or (cur_year == end_year and cur_month <= end_month):
        months.append(f"{cur_year:04d}-{cur_month:02d}")
        cur_month += 1
        if cur_month > 12:
            cur_month = 1
            cur_year += 1

    return months


class AnalyticsService:
    @staticmethod
    def get_summary(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        department: Optional[str] = None,
    ) -> AnalyticsSummaryResponse:
        """
        Calculates organizational summary KPIs:
        - Active & total employees
        - Attendance rate & record breakdown
        - Approved leaves and approved leave days
        - Average performance rating & evaluated count
        """
        validate_date_range(start_date, end_date)

        # 1. Employees in scope
        emp_query = db.query(Employee)
        if department and department.strip() and department.upper() != "ALL":
            emp_query = emp_query.filter(Employee.department == department)
        employees = emp_query.all()
        total_employees = len(employees)
        active_employees = sum(1 for e in employees if e.status == EmployeeStatus.ACTIVE)
        employee_ids = [e.id for e in employees]

        # 2. Attendance in scope
        att_query = db.query(Attendance)
        if department and department.strip() and department.upper() != "ALL":
            if employee_ids:
                att_query = att_query.filter(Attendance.employee_id.in_(employee_ids))
            else:
                att_query = att_query.filter(Attendance.employee_id == -1)
        if start_date:
            att_query = att_query.filter(Attendance.date >= start_date)
        if end_date:
            att_query = att_query.filter(Attendance.date <= end_date)

        att_records = att_query.all()
        total_att = len(att_records)
        present_count = sum(1 for r in att_records if r.status == AttendanceStatus.PRESENT)
        half_day_count = sum(1 for r in att_records if r.status == AttendanceStatus.HALF_DAY)
        absent_count = sum(1 for r in att_records if r.status == AttendanceStatus.ABSENT)
        late_count = sum(1 for r in att_records if r.is_late)

        attendance_rate = (
            round(((present_count + half_day_count) / total_att) * 100.0, 1)
            if total_att > 0
            else None
        )

        # 3. Leaves in scope
        leave_query = db.query(Leave).filter(Leave.status == LeaveStatus.APPROVED)
        if department and department.strip() and department.upper() != "ALL":
            if employee_ids:
                leave_query = leave_query.filter(Leave.employee_id.in_(employee_ids))
            else:
                leave_query = leave_query.filter(Leave.employee_id == -1)
        if start_date:
            leave_query = leave_query.filter(Leave.end_date >= start_date)
        if end_date:
            leave_query = leave_query.filter(Leave.start_date <= end_date)

        approved_leaves_list = leave_query.all()
        approved_leaves = len(approved_leaves_list)
        approved_leave_days = float(sum(l.total_days for l in approved_leaves_list))

        # 4. Performance Reviews in scope
        perf_query = db.query(PerformanceReview)
        if department and department.strip() and department.upper() != "ALL":
            if employee_ids:
                perf_query = perf_query.filter(PerformanceReview.employee_id.in_(employee_ids))
            else:
                perf_query = perf_query.filter(PerformanceReview.employee_id == -1)
        if start_date:
            perf_query = perf_query.filter(func.date(PerformanceReview.created_at) >= start_date)
        if end_date:
            perf_query = perf_query.filter(func.date(PerformanceReview.created_at) <= end_date)

        perf_records = perf_query.all()
        total_reviews = len(perf_records)
        evaluated_emp_ids: Set[int] = {r.employee_id for r in perf_records}
        evaluated_employees = len(evaluated_emp_ids)

        avg_perf_rating = (
            round(sum(r.rating for r in perf_records) / total_reviews, 2)
            if total_reviews > 0
            else None
        )

        return AnalyticsSummaryResponse(
            active_employees=active_employees,
            total_employees=total_employees,
            attendance_rate=attendance_rate,
            total_attendance_records=total_att,
            present_records=present_count,
            half_day_records=half_day_count,
            absent_records=absent_count,
            late_records=late_count,
            approved_leaves=approved_leaves,
            approved_leave_days=approved_leave_days,
            average_performance_rating=avg_perf_rating,
            evaluated_employees=evaluated_employees,
            total_performance_reviews=total_reviews,
        )

    @staticmethod
    def get_attendance_trends(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        department: Optional[str] = None,
    ) -> List[AttendanceTrendItem]:
        """
        Returns attendance trends aggregated by month (YYYY-MM).
        Includes present, half day, absent, late, and calculated rate.
        """
        validate_date_range(start_date, end_date)

        emp_ids = None
        if department and department.strip() and department.upper() != "ALL":
            emp_ids = [
                e.id for e in db.query(Employee.id).filter(Employee.department == department).all()
            ]
            if not emp_ids:
                emp_ids = [-1]

        att_query = db.query(Attendance)
        if emp_ids is not None:
            att_query = att_query.filter(Attendance.employee_id.in_(emp_ids))
        if start_date:
            att_query = att_query.filter(Attendance.date >= start_date)
        if end_date:
            att_query = att_query.filter(Attendance.date <= end_date)

        records = att_query.all()

        # If no explicit dates provided, check bounds of records or default to last 6 months
        months_sequence = generate_month_range(start_date, end_date)

        # Bucket records by month string
        buckets: Dict[str, List[Attendance]] = {m: [] for m in months_sequence}
        for r in records:
            m_str = r.date.strftime("%Y-%m")
            if m_str in buckets:
                buckets[m_str].append(r)
            else:
                buckets[m_str] = [r]

        sorted_months = sorted(buckets.keys())
        trends: List[AttendanceTrendItem] = []
        for m in sorted_months:
            m_records = buckets[m]
            total_m = len(m_records)
            pres = sum(1 for r in m_records if r.status == AttendanceStatus.PRESENT)
            half = sum(1 for r in m_records if r.status == AttendanceStatus.HALF_DAY)
            ab = sum(1 for r in m_records if r.status == AttendanceStatus.ABSENT)
            late = sum(1 for r in m_records if r.is_late)
            rate = round(((pres + half) / total_m) * 100.0, 1) if total_m > 0 else None

            trends.append(
                AttendanceTrendItem(
                    month=m,
                    present_count=pres,
                    half_day_count=half,
                    absent_count=ab,
                    late_count=late,
                    total_records=total_m,
                    attendance_rate=rate,
                )
            )

        return trends

    @staticmethod
    def get_leave_trends(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        department: Optional[str] = None,
    ) -> List[LeaveTrendItem]:
        """
        Returns monthly leave metrics:
        - Submitted requests
        - Approved, pending, rejected, cancelled counts
        - Approved leave days
        """
        validate_date_range(start_date, end_date)

        emp_ids = None
        if department and department.strip() and department.upper() != "ALL":
            emp_ids = [
                e.id for e in db.query(Employee.id).filter(Employee.department == department).all()
            ]
            if not emp_ids:
                emp_ids = [-1]

        leave_query = db.query(Leave)
        if emp_ids is not None:
            leave_query = leave_query.filter(Leave.employee_id.in_(emp_ids))
        if start_date:
            leave_query = leave_query.filter(Leave.end_date >= start_date)
        if end_date:
            leave_query = leave_query.filter(Leave.start_date <= end_date)

        records = leave_query.all()
        months_sequence = generate_month_range(start_date, end_date)

        buckets: Dict[str, List[Leave]] = {m: [] for m in months_sequence}
        for r in records:
            m_str = r.start_date.strftime("%Y-%m")
            if m_str in buckets:
                buckets[m_str].append(r)
            else:
                buckets[m_str] = [r]

        sorted_months = sorted(buckets.keys())
        trends: List[LeaveTrendItem] = []
        for m in sorted_months:
            m_leaves = buckets[m]
            submitted = len(m_leaves)
            approved = sum(1 for l in m_leaves if l.status == LeaveStatus.APPROVED)
            pending = sum(1 for l in m_leaves if l.status == LeaveStatus.PENDING)
            rejected = sum(1 for l in m_leaves if l.status == LeaveStatus.REJECTED)
            cancelled = sum(1 for l in m_leaves if l.status == LeaveStatus.CANCELLED)
            approved_days = float(
                sum(l.total_days for l in m_leaves if l.status == LeaveStatus.APPROVED)
            )

            trends.append(
                LeaveTrendItem(
                    month=m,
                    submitted_count=submitted,
                    approved_count=approved,
                    pending_count=pending,
                    rejected_count=rejected,
                    cancelled_count=cancelled,
                    approved_leave_days=approved_days,
                )
            )

        return trends

    @staticmethod
    def get_performance_insights(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        department: Optional[str] = None,
    ) -> PerformanceInsightsResponse:
        """
        Returns performance rating metrics:
        - Overall average rating
        - Rating distribution (1 to 5)
        - Evaluated employees count
        - Average rating by department
        - Average rating by review period
        """
        validate_date_range(start_date, end_date)

        emp_query = db.query(Employee)
        if department and department.strip() and department.upper() != "ALL":
            emp_query = emp_query.filter(Employee.department == department)
        emp_records = emp_query.all()
        emp_dict = {e.id: e for e in emp_records}
        emp_ids = list(emp_dict.keys())

        if department and department.strip() and department.upper() != "ALL" and not emp_ids:
            return PerformanceInsightsResponse(
                average_rating=None,
                employees_evaluated=0,
                total_reviews=0,
                rating_distribution={"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
                by_department={},
                by_period={},
            )

        perf_query = db.query(PerformanceReview)
        if emp_ids:
            perf_query = perf_query.filter(PerformanceReview.employee_id.in_(emp_ids))
        if start_date:
            perf_query = perf_query.filter(func.date(PerformanceReview.created_at) >= start_date)
        if end_date:
            perf_query = perf_query.filter(func.date(PerformanceReview.created_at) <= end_date)

        reviews = perf_query.all()
        total_reviews = len(reviews)
        distinct_emp_ids = {r.employee_id for r in reviews}
        employees_evaluated = len(distinct_emp_ids)

        avg_rating = (
            round(sum(r.rating for r in reviews) / total_reviews, 2)
            if total_reviews > 0
            else None
        )

        # Rating distribution 1..5
        distribution = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
        for r in reviews:
            key = str(r.rating)
            if key in distribution:
                distribution[key] += 1

        # By department
        dept_totals: Dict[str, List[int]] = {}
        for r in reviews:
            # Look up employee department
            emp = emp_dict.get(r.employee_id) or r.employee
            d = emp.department if emp and emp.department else "Unassigned"
            if d not in dept_totals:
                dept_totals[d] = []
            dept_totals[d].append(r.rating)

        by_department: Dict[str, Optional[float]] = {}
        for d, ratings in sorted(dept_totals.items()):
            by_department[d] = round(sum(ratings) / len(ratings), 2) if ratings else None

        # By review period
        period_totals: Dict[str, List[int]] = {}
        for r in reviews:
            p = r.review_period or "Unknown"
            if p not in period_totals:
                period_totals[p] = []
            period_totals[p].append(r.rating)

        by_period: Dict[str, Optional[float]] = {}
        for p in sorted(period_totals.keys()):
            ratings = period_totals[p]
            by_period[p] = round(sum(ratings) / len(ratings), 2) if ratings else None

        return PerformanceInsightsResponse(
            average_rating=avg_rating,
            employees_evaluated=employees_evaluated,
            total_reviews=total_reviews,
            rating_distribution=distribution,
            by_department=by_department,
            by_period=by_period,
        )

    @staticmethod
    def get_department_reports(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        department: Optional[str] = None,
    ) -> List[DepartmentReportItem]:
        """
        Returns department-wise comparative metrics:
        - Active & total staff
        - Attendance rate & record volume
        - Leave request volume & approved leave days
        - Evaluated employees & average performance rating
        """
        validate_date_range(start_date, end_date)

        # Determine departments to evaluate
        dept_rows = (
            db.query(Employee.department)
            .filter(Employee.department.isnot(None), Employee.department != "")
            .distinct()
            .all()
        )
        all_departments = sorted([r[0] for r in dept_rows if r[0]])

        if department and department.strip() and department.upper() != "ALL":
            selected_depts = [department]
        else:
            selected_depts = all_departments

        reports: List[DepartmentReportItem] = []

        for dept in selected_depts:
            dept_emps = db.query(Employee).filter(Employee.department == dept).all()
            total_emps = len(dept_emps)
            active_emps = sum(1 for e in dept_emps if e.status == EmployeeStatus.ACTIVE)
            emp_ids = [e.id for e in dept_emps]

            if not emp_ids:
                reports.append(
                    DepartmentReportItem(
                        department=dept,
                        active_employees=0,
                        total_employees=0,
                        attendance_records=0,
                        attendance_rate=None,
                        leave_requests=0,
                        approved_leaves=0,
                        approved_leave_days=0.0,
                        evaluated_employees=0,
                        total_reviews=0,
                        average_rating=None,
                    )
                )
                continue

            # Attendance for this department
            att_q = db.query(Attendance).filter(Attendance.employee_id.in_(emp_ids))
            if start_date:
                att_q = att_q.filter(Attendance.date >= start_date)
            if end_date:
                att_q = att_q.filter(Attendance.date <= end_date)
            att_records = att_q.all()
            total_att = len(att_records)
            pres = sum(
                1
                for r in att_records
                if r.status in (AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY)
            )
            att_rate = round((pres / total_att) * 100.0, 1) if total_att > 0 else None

            # Leaves for this department
            leave_q = db.query(Leave).filter(Leave.employee_id.in_(emp_ids))
            if start_date:
                leave_q = leave_q.filter(Leave.end_date >= start_date)
            if end_date:
                leave_q = leave_q.filter(Leave.start_date <= end_date)
            leave_records = leave_q.all()
            total_leaves = len(leave_records)
            approved_leaves_list = [l for l in leave_records if l.status == LeaveStatus.APPROVED]
            approved_count = len(approved_leaves_list)
            approved_days = float(sum(l.total_days for l in approved_leaves_list))

            # Performance reviews for this department
            perf_q = db.query(PerformanceReview).filter(PerformanceReview.employee_id.in_(emp_ids))
            if start_date:
                perf_q = perf_q.filter(func.date(PerformanceReview.created_at) >= start_date)
            if end_date:
                perf_q = perf_q.filter(func.date(PerformanceReview.created_at) <= end_date)
            reviews = perf_q.all()
            total_reviews = len(reviews)
            evaluated_emps = len({r.employee_id for r in reviews})
            avg_rating = (
                round(sum(r.rating for r in reviews) / total_reviews, 2)
                if total_reviews > 0
                else None
            )

            reports.append(
                DepartmentReportItem(
                    department=dept,
                    active_employees=active_emps,
                    total_employees=total_emps,
                    attendance_records=total_att,
                    attendance_rate=att_rate,
                    leave_requests=total_leaves,
                    approved_leaves=approved_count,
                    approved_leave_days=approved_days,
                    evaluated_employees=evaluated_emps,
                    total_reviews=total_reviews,
                    average_rating=avg_rating,
                )
            )

        return reports

    @staticmethod
    def export_department_reports_csv(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        department: Optional[str] = None,
    ) -> str:
        """
        Generates safe, escaped CSV string representation of the department report.
        """
        reports = AnalyticsService.get_department_reports(
            db=db, start_date=start_date, end_date=end_date, department=department
        )

        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # Header row
        writer.writerow(
            [
                "Department",
                "Active Employees",
                "Total Employees",
                "Attendance Records",
                "Attendance Rate (%)",
                "Total Leave Requests",
                "Approved Leaves",
                "Approved Leave Days",
                "Evaluated Employees",
                "Total Reviews",
                "Average Performance Rating",
            ]
        )

        for item in reports:
            writer.writerow(
                [
                    item.department,
                    item.active_employees,
                    item.total_employees,
                    item.attendance_records,
                    f"{item.attendance_rate:.1f}%" if item.attendance_rate is not None else "N/A",
                    item.leave_requests,
                    item.approved_leaves,
                    f"{item.approved_leave_days:.1f}",
                    item.evaluated_employees,
                    item.total_reviews,
                    f"{item.average_rating:.2f}" if item.average_rating is not None else "N/A",
                ]
            )

        return output.getvalue()

