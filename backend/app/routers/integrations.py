"""
Third-Party Integrations & Reports Router
WorkSphere HRMS - Module 25
Handles SMTP Status, Calendar (.ics) feeds & export, and CSV/PDF Data Exports.
"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.announcement import Announcement
from app.models.attendance import Attendance
from app.models.employee import Employee
from app.models.leave import Leave, LeaveStatus
from app.models.payroll import Payroll
from app.models.performance import PerformanceReview
from app.models.resignation import Resignation
from app.models.shift import EmployeeShift
from app.models.task import Task
from app.models.user import User, UserRole
from app.services.calendar_service import generate_ics
from app.services.email_service import get_email_status
from app.services.export_service import generate_csv, generate_pdf

router = APIRouter(tags=["Module 25: Integrations & Reports"])

VALID_REPORT_TYPES = {
    "employees",
    "attendance",
    "leaves",
    "payroll",
    "performance",
    "tasks",
    "resignations",
}


@router.get("/integrations/status")
def get_system_integrations_status(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Returns non-sensitive integration health and configuration status.
    Strictly restricted to Admin and HR roles. Never leaks passwords or API keys.
    """
    smtp_status = get_email_status()
    return {
        "smtp": smtp_status,
        "calendar": {
            "status": "active",
            "format": "iCalendar (.ics)",
            "supported_categories": ["leaves", "shifts", "tasks", "announcements"],
            "events_endpoint": "/api/calendar/events",
            "export_endpoint": "/api/calendar/export.ics",
        },
        "exports": {
            "status": "ready",
            "formats": ["csv", "pdf"],
            "security": ["Formula Injection Sanitization", "Role-Based Access Filtering"],
            "reports": list(VALID_REPORT_TYPES),
        },
    }


def _fetch_calendar_events(user: User, db: Session) -> List[Dict[str, Any]]:
    """Helper to collect upcoming events accessible to the current user."""
    events: List[Dict[str, Any]] = []
    is_admin_or_hr = user.role in (UserRole.ADMIN, UserRole.HR)
    emp = user.employee

    # 1. Approved Leaves
    leave_query = db.query(Leave).filter(Leave.status == LeaveStatus.APPROVED)
    if not is_admin_or_hr:
        if emp:
            leave_query = leave_query.filter(Leave.employee_id == emp.id)
        else:
            leave_query = leave_query.filter(Leave.id == -1)  # No employee profile
    approved_leaves = leave_query.limit(100).all()

    for lv in approved_leaves:
        emp_name = lv.employee.full_name if lv.employee else f"Employee #{lv.employee_id}"
        events.append(
            {
                "id": lv.id,
                "type": "leave",
                "title": f"Leave: {emp_name} ({lv.leave_type.value if hasattr(lv.leave_type, 'value') else lv.leave_type})",
                "description": f"Approved leave request: {lv.reason or 'No reason provided'}",
                "start": lv.start_date,
                "end": lv.end_date,
                "all_day": True,
            }
        )

    # 2. Assigned Shifts (for employee)
    if emp:
        shifts = db.query(EmployeeShift).filter(EmployeeShift.employee_id == emp.id).all()
        for s in shifts:
            shift_title = s.shift.shift_type.value if hasattr(s.shift.shift_type, "value") else str(s.shift.shift_type)
            events.append(
                {
                    "id": s.id,
                    "type": "shift",
                    "title": f"Shift: {shift_title}",
                    "description": f"Shift timing: {s.shift.start_time} - {s.shift.end_time}",
                    "start": s.start_date,
                    "end": s.end_date or s.start_date,
                    "all_day": True,
                }
            )

    # 3. Tasks
    task_query = db.query(Task)
    if not is_admin_or_hr:
        if emp:
            task_query = task_query.filter(Task.assigned_to == emp.id)
        else:
            task_query = task_query.filter(Task.id == -1)
    tasks = task_query.limit(100).all()

    for t in tasks:
        events.append(
            {
                "id": t.id,
                "type": "task",
                "title": f"Task Due: {t.title}",
                "description": t.description or "No description",
                "start": t.due_date,
                "end": t.due_date,
                "all_day": True,
            }
        )

    # 4. Announcements
    announcements = db.query(Announcement).order_by(Announcement.created_at.desc()).limit(15).all()
    for a in announcements:
        events.append(
            {
                "id": a.id,
                "type": "announcement",
                "title": f"Announcement: {a.title}",
                "description": a.content,
                "start": a.created_at.date() if isinstance(a.created_at, datetime) else a.created_at,
                "end": a.created_at.date() if isinstance(a.created_at, datetime) else a.created_at,
                "all_day": True,
            }
        )

    return events


@router.get("/calendar/events")
def get_calendar_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns upcoming calendar events (leaves, shifts, tasks, announcements)
    filtered by the requesting user's authorization and role.
    """
    return _fetch_calendar_events(current_user, db)


@router.get("/calendar/export.ics")
def export_calendar_ics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates and downloads a standard RFC 5545 iCalendar (.ics) file
    containing events personalized to the user.
    """
    events = _fetch_calendar_events(current_user, db)
    ics_text = generate_ics(f"WorkSphere - {current_user.username}", events)

    return Response(
        content=ics_text,
        media_type="text/calendar",
        headers={
            "Content-Disposition": "attachment; filename=worksphere_schedule.ics",
            "Cache-Control": "no-cache",
        },
    )


@router.get("/exports/{report_type}")
def export_report_data(
    report_type: str,
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exports organization or personal data in CSV or PDF format.
    - CSV exports are protected against formula injection.
    - Employees cannot export Organization Payroll or Employee Directory (403 Forbidden).
    - Other categories are automatically scoped to the employee's personal data.
    """
    normalized_type = report_type.lower().strip()
    if normalized_type not in VALID_REPORT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid report type '{report_type}'. Allowed: {', '.join(sorted(VALID_REPORT_TYPES))}",
        )

    is_admin_or_hr = current_user.role in (UserRole.ADMIN, UserRole.HR)
    emp = current_user.employee

    # Strict RBAC on privileged reports
    if normalized_type in ("employees", "payroll") and not is_admin_or_hr:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: You do not have permission to export {normalized_type} reports.",
        )

    headers: List[str] = []
    rows: List[List[Any]] = []
    title = f"{normalized_type.capitalize()} Report"

    if normalized_type == "employees":
        headers = ["ID", "Full Name", "Department", "Designation", "Joining Date", "Salary", "Status"]
        employees = db.query(Employee).order_by(Employee.id.asc()).all()
        for e in employees:
            rows.append([
                e.id,
                e.full_name,
                e.department,
                e.designation,
                e.joining_date.isoformat() if e.joining_date else "",
                f"{float(e.salary):.2f}" if e.salary is not None else "0.00",
                e.status.value if hasattr(e.status, "value") else str(e.status),
            ])

    elif normalized_type == "attendance":
        headers = ["ID", "Employee Name", "Date", "Check In", "Check Out", "Work Hours", "Status"]
        query = db.query(Attendance)
        if not is_admin_or_hr:
            query = query.filter(Attendance.employee_id == (emp.id if emp else -1))
        attendances = query.order_by(Attendance.date.desc()).all()
        for a in attendances:
            emp_name = a.employee.full_name if a.employee else f"EMP#{a.employee_id}"
            cin = a.check_in.strftime("%H:%M:%S") if a.check_in else "--"
            cout = a.check_out.strftime("%H:%M:%S") if a.check_out else "--"
            rows.append([
                a.id,
                emp_name,
                a.date.isoformat() if a.date else "",
                cin,
                cout,
                f"{float(a.working_hours):.1f}" if a.working_hours is not None else "0.0",
                a.status.value if hasattr(a.status, "value") else str(a.status),
            ])

    elif normalized_type == "leaves":
        headers = ["ID", "Employee Name", "Leave Type", "Start Date", "End Date", "Days", "Reason", "Status"]
        query = db.query(Leave)
        if not is_admin_or_hr:
            query = query.filter(Leave.employee_id == (emp.id if emp else -1))
        leaves = query.order_by(Leave.start_date.desc()).all()
        for lv in leaves:
            emp_name = lv.employee.full_name if lv.employee else f"EMP#{lv.employee_id}"
            ltype = lv.leave_type.value if hasattr(lv.leave_type, "value") else str(lv.leave_type)
            lstat = lv.status.value if hasattr(lv.status, "value") else str(lv.status)
            rows.append([
                lv.id,
                emp_name,
                ltype,
                lv.start_date.isoformat() if lv.start_date else "",
                lv.end_date.isoformat() if lv.end_date else "",
                lv.total_days or 1,
                lv.reason or "",
                lstat,
            ])

    elif normalized_type == "payroll":
        headers = ["ID", "Employee Name", "Month", "Year", "Base Salary", "Allowances", "Deductions", "Net Salary", "Payment Status"]
        payrolls = db.query(Payroll).order_by(Payroll.year.desc(), Payroll.month.desc()).all()
        for p in payrolls:
            emp_name = p.employee.full_name if p.employee else f"EMP#{p.employee_id}"
            pstat = p.payment_status.value if hasattr(p.payment_status, "value") else str(p.payment_status)
            rows.append([
                p.id,
                emp_name,
                p.month,
                p.year,
                f"{float(p.base_salary):.2f}" if p.base_salary is not None else "0.00",
                f"{float(p.allowances):.2f}" if p.allowances is not None else "0.00",
                f"{float(p.deductions):.2f}" if p.deductions is not None else "0.00",
                f"{float(p.net_salary):.2f}" if p.net_salary is not None else "0.00",
                pstat,
            ])

    elif normalized_type == "performance":
        headers = ["ID", "Employee Name", "Review Period", "Rating", "Feedback", "Reviewer"]
        query = db.query(PerformanceReview)
        if not is_admin_or_hr:
            query = query.filter(PerformanceReview.employee_id == (emp.id if emp else -1))
        reviews = query.order_by(PerformanceReview.created_at.desc()).all()
        for r in reviews:
            emp_name = r.employee.full_name if r.employee else f"EMP#{r.employee_id}"
            reviewer_str = r.reviewer.username if r.reviewer else "--"
            rows.append([
                r.id,
                emp_name,
                r.review_period,
                r.rating,
                (r.feedback[:50] + "...") if r.feedback and len(r.feedback) > 50 else (r.feedback or ""),
                reviewer_str,
            ])

    elif normalized_type == "tasks":
        headers = ["ID", "Title", "Assigned To", "Due Date", "Status", "Created At"]
        query = db.query(Task)
        if not is_admin_or_hr:
            query = query.filter(Task.assigned_to == (emp.id if emp else -1))
        tasks = query.order_by(Task.due_date.asc()).all()
        for t in tasks:
            assigned_name = t.assigned_employee.full_name if t.assigned_employee else f"EMP#{t.assigned_to}"
            tstat = t.status.value if hasattr(t.status, "value") else str(t.status)
            rows.append([
                t.id,
                t.title,
                assigned_name,
                t.due_date.isoformat() if t.due_date else "",
                tstat,
                t.created_at.strftime("%Y-%m-%d") if t.created_at else "",
            ])

    elif normalized_type == "resignations":
        headers = ["ID", "Employee Name", "Notice Period (Days)", "Reason", "Status", "Submitted At"]
        query = db.query(Resignation)
        if not is_admin_or_hr:
            query = query.filter(Resignation.employee_id == (emp.id if emp else -1))
        resignations = query.order_by(Resignation.created_at.desc()).all()
        for res in resignations:
            emp_name = res.employee.full_name if res.employee else f"EMP#{res.employee_id}"
            rstat = res.status.value if hasattr(res.status, "value") else str(res.status)
            rows.append([
                res.id,
                emp_name,
                res.notice_period,
                (res.reason[:50] + "...") if res.reason and len(res.reason) > 50 else (res.reason or ""),
                rstat,
                res.created_at.strftime("%Y-%m-%d") if res.created_at else "",
            ])

    # Deliver output based on format
    if format == "csv":
        csv_bytes = generate_csv(headers, rows)
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=worksphere_{normalized_type}_export.csv",
                "Cache-Control": "no-cache",
            },
        )
    elif format == "pdf":
        subtitle = "Organization Report" if is_admin_or_hr else f"Personal Report for {current_user.username}"
        pdf_bytes = generate_pdf(title=title, headers=headers, rows=rows, subtitle=subtitle)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=worksphere_{normalized_type}_export.pdf",
                "Cache-Control": "no-cache",
            },
        )
