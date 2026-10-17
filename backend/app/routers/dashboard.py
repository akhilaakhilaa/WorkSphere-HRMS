from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_employee, get_current_user, require_roles
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.leave import Leave, LeaveStatus, LeaveType
from app.models.notification import Notification
from app.models.payroll import PaymentStatus, Payroll
from app.models.user import User, UserRole
from app.schemas.dashboard import (
    ActivityItem,
    DashboardAnalytics,
    DashboardKPIs,
    DepartmentStat,
    EmployeePersonalDashboard,
)
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/dashboard", tags=["Module 6: Dashboard & Analytics"])


@router.get("/analytics", response_model=DashboardAnalytics)
def get_organization_dashboard_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Returns executive KPI cards and analytics for employees, attendance, leaves, and payroll.
    Restricted to ADMIN and HR.
    """
    today = date.today()
    current_month = today.month
    current_year = today.year

    # 1. Employees KPI
    total_employees = db.query(Employee).count()
    active_employees = (
        db.query(Employee).filter(Employee.status == EmployeeStatus.ACTIVE).count()
    )
    departments = db.query(Employee.department).distinct().all()
    departments_count = len([d[0] for d in departments if d[0]])

    # 2. Today's Attendance KPI
    today_records = db.query(Attendance).filter(Attendance.date == today).all()
    today_checked_in = len([r for r in today_records if r.check_in is not None])
    today_present = len([r for r in today_records if r.status == AttendanceStatus.PRESENT])
    today_half_day = len([r for r in today_records if r.status == AttendanceStatus.HALF_DAY])
    att_rate = (
        round((today_checked_in / active_employees) * 100, 1)
        if active_employees > 0
        else 0.0
    )

    # 3. Leaves KPI
    pending_leaves = (
        db.query(Leave).filter(Leave.status == LeaveStatus.PENDING).count()
    )
    approved_this_month = (
        db.query(Leave)
        .filter(
            Leave.status == LeaveStatus.APPROVED,
            func.month(Leave.start_date) == current_month,
            func.year(Leave.start_date) == current_year,
        )
        .count()
    )
    on_leave_today = (
        db.query(Leave)
        .filter(
            Leave.status == LeaveStatus.APPROVED,
            Leave.start_date <= today,
            Leave.end_date >= today,
        )
        .count()
    )

    # 4. Payroll KPI (Current Month/Year)
    current_payrolls = (
        db.query(Payroll)
        .filter(Payroll.month == current_month, Payroll.year == current_year)
        .all()
    )
    if not current_payrolls:
        # Fallback to latest available payroll period if current has none generated yet
        latest_p = (
            db.query(Payroll)
            .order_by(Payroll.year.desc(), Payroll.month.desc())
            .first()
        )
        if latest_p:
            current_payrolls = (
                db.query(Payroll)
                .filter(Payroll.month == latest_p.month, Payroll.year == latest_p.year)
                .all()
            )

    curr_total_payout = sum((p.net_salary for p in current_payrolls), Decimal("0.00"))
    curr_paid_amount = sum(
        (p.net_salary for p in current_payrolls if p.payment_status == PaymentStatus.PAID),
        Decimal("0.00"),
    )
    curr_pending_amount = sum(
        (p.net_salary for p in current_payrolls if p.payment_status != PaymentStatus.PAID),
        Decimal("0.00"),
    )
    curr_paid_count = sum(1 for p in current_payrolls if p.payment_status == PaymentStatus.PAID)
    curr_pending_count = sum(
        1 for p in current_payrolls if p.payment_status != PaymentStatus.PAID
    )

    kpis = DashboardKPIs(
        total_employees=total_employees,
        active_employees=active_employees,
        departments_count=departments_count,
        today_attendance={
            "checked_in_count": today_checked_in,
            "present_count": today_present,
            "half_day_count": today_half_day,
            "attendance_rate": att_rate,
        },
        leaves_kpi={
            "pending_approvals": pending_leaves,
            "approved_this_month": approved_this_month,
            "on_leave_today": on_leave_today,
        },
        payroll_kpi={
            "period": f"{current_month}/{current_year}",
            "total_payout": round(curr_total_payout, 2),
            "paid_amount": round(curr_paid_amount, 2),
            "pending_amount": round(curr_pending_amount, 2),
            "paid_count": curr_paid_count,
            "pending_count": curr_pending_count,
        },
    )

    # 5. Department Distribution
    dept_stats: List[DepartmentStat] = []
    dept_rows = (
        db.query(
            Employee.department,
            func.count(Employee.id).label("count"),
            func.sum(Employee.salary).label("total_salary"),
        )
        .group_by(Employee.department)
        .all()
    )
    for dept_name, count, total_sal in dept_rows:
        active_in_dept = (
            db.query(Employee)
            .filter(
                Employee.department == dept_name,
                Employee.status == EmployeeStatus.ACTIVE,
            )
            .count()
        )
        dept_stats.append(
            DepartmentStat(
                department=dept_name,
                employee_count=count,
                total_payroll=round(total_sal or Decimal("0.00"), 2),
                active_count=active_in_dept,
            )
        )

    # 6. Attendance Distribution (overall)
    all_att = db.query(Attendance.status, func.count(Attendance.id)).group_by(Attendance.status).all()
    att_breakdown = {status.value: count for status, count in all_att}
    for s in AttendanceStatus:
        if s.value not in att_breakdown:
            att_breakdown[s.value] = 0

    # 7. Leave Types Distribution
    all_leaves = db.query(Leave.leave_type, func.count(Leave.id)).group_by(Leave.leave_type).all()
    leave_breakdown = {ltype.value: count for ltype, count in all_leaves}
    for lt in LeaveType:
        if lt.value not in leave_breakdown:
            leave_breakdown[lt.value] = 0

    # 8. Monthly Payroll Trend (last 6 payroll batches)
    trend_rows = (
        db.query(
            Payroll.year,
            Payroll.month,
            func.sum(Payroll.net_salary).label("total_net"),
            func.count(Payroll.id).label("count"),
        )
        .group_by(Payroll.year, Payroll.month)
        .order_by(Payroll.year.desc(), Payroll.month.desc())
        .limit(6)
        .all()
    )
    payroll_trend = [
        {
            "period": f"{m}/{y}",
            "month": m,
            "year": y,
            "total_net_salary": float(total_net or 0),
            "employees_paid": count,
        }
        for y, m, total_net, count in reversed(trend_rows)
    ]

    # 9. Recent Activity Feed
    recent_activities: List[ActivityItem] = []

    # Recent Leaves
    recent_leaves = db.query(Leave).order_by(Leave.id.desc()).limit(3).all()
    for l in recent_leaves:
        emp_name = l.employee.full_name if l.employee else "Employee"
        recent_activities.append(
            ActivityItem(
                id=f"leave_{l.id}",
                type="LEAVE",
                title=f"Leave Request ({l.leave_type.value})",
                description=f"{emp_name} requested {l.total_days} days ({l.start_date} to {l.end_date})",
                timestamp=l.created_at.strftime("%Y-%m-%d %H:%M"),
                status=l.status.value,
            )
        )

    # Recent Attendances
    recent_atts = (
        db.query(Attendance).order_by(Attendance.id.desc()).limit(3).all()
    )
    for a in recent_atts:
        emp_name = a.employee.full_name if a.employee else "Employee"
        cin_str = a.check_in.strftime("%H:%M") if a.check_in else "-"
        cout_str = a.check_out.strftime("%H:%M") if a.check_out else "Active"
        recent_activities.append(
            ActivityItem(
                id=f"att_{a.id}",
                type="ATTENDANCE",
                title=f"Attendance Log ({a.date})",
                description=f"{emp_name} checked in at {cin_str} (Out: {cout_str})",
                timestamp=a.created_at.strftime("%Y-%m-%d %H:%M"),
                status=a.status.value,
            )
        )

    # Recent Payrolls
    recent_payrolls = (
        db.query(Payroll).order_by(Payroll.id.desc()).limit(3).all()
    )
    for p in recent_payrolls:
        emp_name = p.employee.full_name if p.employee else "Employee"
        recent_activities.append(
            ActivityItem(
                id=f"pay_{p.id}",
                type="PAYROLL",
                title=f"Payroll ({p.month}/{p.year})",
                description=f"{emp_name} payslip generated: ${p.net_salary:,.2f}",
                timestamp=p.created_at.strftime("%Y-%m-%d %H:%M"),
                status=p.payment_status.value,
            )
        )

    # Sort combined activities by timestamp
    recent_activities.sort(key=lambda x: x.timestamp, reverse=True)

    return DashboardAnalytics(
        kpis=kpis,
        department_distribution=dept_stats,
        attendance_breakdown=att_breakdown,
        leave_types_breakdown=leave_breakdown,
        monthly_payroll_trend=payroll_trend,
        recent_activities=recent_activities[:8],
    )


@router.get("/my-stats", response_model=EmployeePersonalDashboard)
def get_my_personal_dashboard(
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    Returns personal dashboard snapshot for currently logged-in employee:
    today's attendance, overall attendance summary, leave balances, and latest payslip.
    """
    today = date.today()

    # Today's attendance
    today_rec = (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee.id, Attendance.date == today)
        .first()
    )
    today_dict = None
    if today_rec:
        today_dict = {
            "check_in": today_rec.check_in.isoformat() if today_rec.check_in else None,
            "check_out": today_rec.check_out.isoformat() if today_rec.check_out else None,
            "working_hours": float(today_rec.working_hours) if today_rec.working_hours else 0.0,
            "status": today_rec.status.value,
        }

    # All attendance stats
    att_records = db.query(Attendance).filter(Attendance.employee_id == employee.id).all()
    total_days = len(att_records)
    present_days = sum(1 for r in att_records if r.status == AttendanceStatus.PRESENT)
    half_days = sum(1 for r in att_records if r.status == AttendanceStatus.HALF_DAY)
    absent_days = sum(1 for r in att_records if r.status == AttendanceStatus.ABSENT)
    total_hours = sum((r.working_hours or Decimal("0.00")) for r in att_records)

    # Leaves stats
    emp_leaves = db.query(Leave).filter(Leave.employee_id == employee.id).all()
    pending_leaves = sum(1 for l in emp_leaves if l.status == LeaveStatus.PENDING)
    approved_leaves = sum(1 for l in emp_leaves if l.status == LeaveStatus.APPROVED)
    rejected_leaves = sum(1 for l in emp_leaves if l.status == LeaveStatus.REJECTED)
    approved_days = sum(l.total_days for l in emp_leaves if l.status == LeaveStatus.APPROVED)

    # Latest payslip
    latest_payroll = (
        db.query(Payroll)
        .filter(Payroll.employee_id == employee.id)
        .order_by(Payroll.year.desc(), Payroll.month.desc())
        .first()
    )
    payslip_dict = None
    if latest_payroll:
        payslip_dict = {
            "id": latest_payroll.id,
            "month": latest_payroll.month,
            "year": latest_payroll.year,
            "net_salary": float(latest_payroll.net_salary),
            "payment_status": latest_payroll.payment_status.value,
            "payment_date": latest_payroll.payment_date.isoformat() if latest_payroll.payment_date else None,
        }

    return EmployeePersonalDashboard(
        employee_id=employee.id,
        full_name=employee.full_name,
        designation=employee.designation,
        department=employee.department,
        today_attendance=today_dict,
        attendance_stats={
            "total_days": total_days,
            "present_days": present_days,
            "half_days": half_days,
            "absent_days": absent_days,
            "total_hours": float(round(total_hours, 2)),
        },
        leave_stats={
            "total_applications": len(emp_leaves),
            "pending": pending_leaves,
            "approved": approved_leaves,
            "rejected": rejected_leaves,
            "days_taken": approved_days,
            "annual_balance": max(0, 20 - approved_days),
        },
        latest_payslip=payslip_dict,
    )


@router.get("/notifications", response_model=List[NotificationResponse])
def get_user_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 20,
):
    """Returns recent notifications for current authenticated user."""
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.id.desc())
        .limit(limit)
        .all()
    )
    return notifs


@router.put("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read."""
    notif = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif

