from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_employee, get_current_user, require_roles
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee
from app.models.notification import NotificationType
from app.models.shift import EmployeeShift, Shift
from app.models.user import User, UserRole
from app.schemas.attendance import (
    AttendanceManualRecord,
    AttendanceResponse,
    AttendanceSummary,
    AttendanceUpdate,
    AutoAbsentResponse,
    CheckInRequest,
    CheckOutRequest,
)
from app.utils.notifications import notify_admins_and_hr, notify_user

router = APIRouter(prefix="/attendance", tags=["Attendance Management"])


def _to_attendance_response(att: Attendance) -> AttendanceResponse:
    shift = att.shift
    return AttendanceResponse(
        id=att.id,
        employee_id=att.employee_id,
        employee_name=att.employee.full_name if att.employee else None,
        shift_id=att.shift_id,
        shift_name=shift.name if shift else None,
        scheduled_start=shift.start_time if shift else None,
        scheduled_end=shift.end_time if shift else None,
        date=att.date,
        check_in=att.check_in,
        check_out=att.check_out,
        working_hours=att.working_hours,
        overtime_hours=att.overtime_hours,
        status=att.status,
        is_late=att.is_late if att.is_late is not None else False,
        late_minutes=att.late_minutes if att.late_minutes is not None else 0,
        is_early_departure=att.is_early_departure if att.is_early_departure is not None else False,
        early_departure_minutes=att.early_departure_minutes if att.early_departure_minutes is not None else 0,
        notes=att.notes,
        created_at=att.created_at,
        updated_at=att.updated_at,
    )


@router.post("/check-in", response_model=AttendanceResponse)
def check_in(
    check_in_data: Optional[CheckInRequest] = None,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    Check-in for the current authenticated employee for today.
    Detects late arrival according to employee's assigned shift or standard shift.
    Prevents duplicate check-ins.
    """
    today = date.today()

    record = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.id,
            Attendance.date == today,
        )
        .first()
    )

    # Prevent duplicate check-ins
    if record and record.check_in:
        time_str = record.check_in.strftime("%H:%M:%S")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Duplicate check-in: You have already checked in "
                f"today at {time_str}."
            ),
        )

    now = datetime.now()

    # Look up active shift assignment
    active_assignment = (
        db.query(EmployeeShift)
        .filter(
            EmployeeShift.employee_id == employee.id,
            EmployeeShift.is_active == True,
        )
        .first()
    )
    shift = active_assignment.shift if active_assignment else None

    # Calculate late status
    is_late = False
    late_minutes = 0
    late_alert_desc = "the standard 09:30 AM shift start"

    if shift:
        shift_start = shift.start_time
        grace = shift.grace_period_minutes
        scheduled_start_dt = datetime.combine(now.date(), shift_start)
        deadline = scheduled_start_dt + timedelta(minutes=grace)

        if now > deadline:
            is_late = True
            diff_secs = (now - scheduled_start_dt).total_seconds()
            late_minutes = max(1, int(diff_secs / 60))
            late_alert_desc = f"{shift.name} scheduled start ({shift_start.strftime('%I:%M %p')})"
    else:
        # Standard fallback to 09:30 AM (preserves existing notification & test expectations)
        std_start = time(9, 30)
        scheduled_start_dt = datetime.combine(now.date(), std_start)
        if now > scheduled_start_dt:
            is_late = True
            diff_secs = (now - scheduled_start_dt).total_seconds()
            late_minutes = max(1, int(diff_secs / 60))
        late_alert_desc = "the standard 09:30 AM shift start"

    if record:
        # Reuse an existing record if one exists without a check-in
        record.check_in = now
        record.status = AttendanceStatus.PRESENT
        record.shift_id = shift.id if shift else record.shift_id
        record.is_late = is_late
        record.late_minutes = late_minutes

        if check_in_data and check_in_data.notes:
            record.notes = (
                f"{record.notes}\nCheck-in note: {check_in_data.notes}"
                if record.notes
                else check_in_data.notes
            )
    else:
        record = Attendance(
            employee_id=employee.id,
            shift_id=shift.id if shift else None,
            date=today,
            check_in=now,
            status=AttendanceStatus.PRESENT,
            is_late=is_late,
            late_minutes=late_minutes,
            notes=check_in_data.notes if check_in_data else None,
        )
        db.add(record)
        db.flush()

    # Notify employee about check-in and late arrival
    if employee.user_id:
        time_str = now.strftime("%I:%M %p")

        if is_late:
            notify_user(
                db,
                user_id=employee.user_id,
                title="Late Attendance Alert",
                message=(
                    f"You checked in at {time_str} on {today}, "
                    f"which is recorded after {late_alert_desc}."
                ),
                notif_type=NotificationType.ATTENDANCE,
                link="/attendance",
                related_entity_id=record.id,
                prevent_duplicate=True,
            )
        else:
            notify_user(
                db,
                user_id=employee.user_id,
                title="Attendance Checked In",
                message=(
                    f"You successfully checked in today ({today}) "
                    f"at {time_str}."
                ),
                notif_type=NotificationType.ATTENDANCE,
                link="/attendance",
                related_entity_id=record.id,
                prevent_duplicate=True,
            )

    db.commit()
    db.refresh(record)

    return _to_attendance_response(record)


@router.post("/check-out", response_model=AttendanceResponse)
def check_out(
    check_out_data: Optional[CheckOutRequest] = None,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    Check-out for the current authenticated employee.
    Detects early departure according to employee's assigned shift.
    Calculates working hours, overtime, and attendance status.
    """
    today = date.today()

    record = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.id,
            Attendance.date == today,
        )
        .first()
    )

    if not record or not record.check_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must check in before checking out.",
        )

    if record.check_out:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already checked out today.",
        )

    now = datetime.now()
    delta = now - record.check_in

    hours = max(
        Decimal("0.00"),
        round(
            Decimal(str(delta.total_seconds())) / Decimal("3600"),
            2,
        ),
    )

    standard_hours = Decimal("8.00")
    overtime_hours = max(
        Decimal("0.00"),
        hours - standard_hours,
    )

    if hours >= Decimal("8.00"):
        new_status = AttendanceStatus.PRESENT
    else:
        new_status = AttendanceStatus.HALF_DAY

    # Detect early departure
    shift = record.shift
    if not shift:
        active_assignment = (
            db.query(EmployeeShift)
            .filter(
                EmployeeShift.employee_id == employee.id,
                EmployeeShift.is_active == True,
            )
            .first()
        )
        if active_assignment:
            shift = active_assignment.shift
            record.shift_id = shift.id

    is_early = False
    early_minutes = 0

    if shift:
        if shift.is_overnight or shift.start_time > shift.end_time:
            scheduled_end_dt = datetime.combine(
                record.check_in.date() + timedelta(days=1), shift.end_time
            )
        else:
            scheduled_end_dt = datetime.combine(record.check_in.date(), shift.end_time)

        if now < scheduled_end_dt:
            is_early = True
            diff_secs = (scheduled_end_dt - now).total_seconds()
            early_minutes = max(1, int(diff_secs / 60))

    record.check_out = now
    record.working_hours = hours
    record.overtime_hours = overtime_hours
    record.status = new_status
    record.is_early_departure = is_early
    record.early_departure_minutes = early_minutes

    if check_out_data and check_out_data.notes:
        record.notes = (
            f"{record.notes}\nCheck-out note: {check_out_data.notes}"
            if record.notes
            else check_out_data.notes
        )

    if employee.user_id:
        time_str = now.strftime("%I:%M %p")
        early_note = f" (Early departure: {early_minutes} mins before scheduled end)" if is_early else ""

        notify_user(
            db,
            user_id=employee.user_id,
            title="Attendance Checked Out",
            message=(
                f"You checked out today at {time_str}. "
                f"Total hours: {hours} hrs. "
                f"Overtime: {overtime_hours} hrs.{early_note}"
            ),
            notif_type=NotificationType.ATTENDANCE,
            link="/attendance",
            related_entity_id=record.id,
            prevent_duplicate=True,
        )

    db.commit()
    db.refresh(record)

    return _to_attendance_response(record)


@router.get("/today", response_model=Optional[AttendanceResponse])
def get_today_attendance(
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Returns today's attendance record for the current employee."""
    today = date.today()
    record = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee.id,
            Attendance.date == today,
        )
        .first()
    )
    if not record:
        return None
    return _to_attendance_response(record)


@router.get("/my-history", response_model=List[AttendanceResponse])
def get_my_attendance_history(
    employee: Employee = Depends(get_current_employee),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    status: Optional[AttendanceStatus] = Query(None),
    db: Session = Depends(get_db),
):
    """Returns attendance history for the currently logged-in employee."""
    query = db.query(Attendance).filter(Attendance.employee_id == employee.id)

    if status:
        query = query.filter(Attendance.status == status)

    records = query.order_by(Attendance.date.desc()).all()

    if month or year:
        filtered = []
        for r in records:
            if month and r.date.month != month:
                continue
            if year and r.date.year != year:
                continue
            filtered.append(r)
        records = filtered

    return [_to_attendance_response(r) for r in records]


@router.get("/summary", response_model=AttendanceSummary)
def get_attendance_summary(
    employee_id: Optional[int] = Query(None, description="HR/Admin: filter by specific employee"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns aggregated attendance metrics."""
    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No employee profile found for current user",
            )
        target_emp_id = emp.id
    else:
        target_emp_id = employee_id

    query = db.query(Attendance)
    if target_emp_id:
        query = query.filter(Attendance.employee_id == target_emp_id)

    records = query.all()
    total_records = len(records)
    present_days = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
    half_days = sum(1 for r in records if r.status == AttendanceStatus.HALF_DAY)
    absent_days = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
    total_hours = sum((r.working_hours or Decimal("0.00")) for r in records)
    total_overtime = sum((r.overtime_hours or Decimal("0.00")) for r in records)

    return AttendanceSummary(
        total_records=total_records,
        present_days=present_days,
        half_days=half_days,
        absent_days=absent_days,
        total_hours=round(total_hours, 2),
        total_overtime_hours=round(total_overtime, 2),
    )


@router.get("", response_model=List[AttendanceResponse])
def list_attendance(
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
    date_filter: Optional[date] = Query(None, alias="date", description="Filter by specific date"),
    status: Optional[AttendanceStatus] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    List attendance records across the organization.
    Restricted to ADMIN and HR.
    """
    query = db.query(Attendance)

    if employee_id:
        query = query.filter(Attendance.employee_id == employee_id)
    if date_filter:
        query = query.filter(Attendance.date == date_filter)
    if status:
        query = query.filter(Attendance.status == status)

    records = query.order_by(Attendance.date.desc(), Attendance.id.desc()).offset(skip).limit(limit).all()
    return [_to_attendance_response(r) for r in records]


@router.post("/manual", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def manual_attendance_record(
    rec_in: AttendanceManualRecord,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Manually record or override attendance for an employee.
    Restricted to ADMIN and HR.
    """
    emp = db.query(Employee).filter(Employee.id == rec_in.employee_id).first()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {rec_in.employee_id} not found",
        )

    # Check if a record already exists for this date
    existing = (
        db.query(Attendance)
        .filter(Attendance.employee_id == rec_in.employee_id, Attendance.date == rec_in.date)
        .first()
    )

    working_hours = rec_in.working_hours
    if working_hours is None and rec_in.check_in and rec_in.check_out:
        delta = rec_in.check_out - rec_in.check_in
        working_hours = round(Decimal(delta.total_seconds()) / Decimal(3600.0), 2)

    overtime_hours = rec_in.overtime_hours
    if (overtime_hours is None or overtime_hours == Decimal("0.00")) and working_hours is not None:
        overtime_hours = max(Decimal("0.00"), working_hours - Decimal("8.00"))
    elif overtime_hours is None:
        overtime_hours = Decimal("0.00")

    # Look up active shift for employee
    active_assignment = (
        db.query(EmployeeShift)
        .filter(
            EmployeeShift.employee_id == emp.id,
            EmployeeShift.is_active == True,
        )
        .first()
    )
    shift = active_assignment.shift if active_assignment else None

    is_late = False
    late_minutes = 0
    is_early = False
    early_minutes = 0

    if shift and rec_in.check_in:
        shift_start = shift.start_time
        deadline = datetime.combine(rec_in.date, shift_start) + timedelta(minutes=shift.grace_period_minutes)
        if rec_in.check_in > deadline:
            is_late = True
            late_minutes = max(1, int((rec_in.check_in - datetime.combine(rec_in.date, shift_start)).total_seconds() / 60))

    if shift and rec_in.check_out:
        if shift.is_overnight or shift.start_time > shift.end_time:
            scheduled_end_dt = datetime.combine(rec_in.date + timedelta(days=1), shift.end_time)
        else:
            scheduled_end_dt = datetime.combine(rec_in.date, shift.end_time)

        if rec_in.check_out < scheduled_end_dt:
            is_early = True
            early_minutes = max(1, int((scheduled_end_dt - rec_in.check_out).total_seconds() / 60))

    if existing:
        existing.check_in = rec_in.check_in
        existing.check_out = rec_in.check_out
        existing.working_hours = working_hours
        existing.overtime_hours = overtime_hours
        existing.status = rec_in.status
        existing.notes = rec_in.notes
        if shift:
            existing.shift_id = shift.id
        existing.is_late = is_late
        existing.late_minutes = late_minutes
        existing.is_early_departure = is_early
        existing.early_departure_minutes = early_minutes
        res_rec = existing
    else:
        new_record = Attendance(
            employee_id=rec_in.employee_id,
            shift_id=shift.id if shift else None,
            date=rec_in.date,
            check_in=rec_in.check_in,
            check_out=rec_in.check_out,
            working_hours=working_hours,
            overtime_hours=overtime_hours,
            status=rec_in.status,
            is_late=is_late,
            late_minutes=late_minutes,
            is_early_departure=is_early,
            early_departure_minutes=early_minutes,
            notes=rec_in.notes,
        )
        db.add(new_record)
        res_rec = new_record

    # Attendance Alert: Notify employee of manual record/override
    if emp.user_id:
        status_note = f" (Note: {rec_in.notes})" if rec_in.notes else ""
        if rec_in.status == AttendanceStatus.ABSENT:
            alert_title = "Absence Recorded Alert"
            alert_msg = f"You have been recorded as ABSENT for {rec_in.date} by HR/Admin.{status_note}"
        else:
            alert_title = "Manual Attendance Notice"
            alert_msg = f"Your attendance for {rec_in.date} was recorded as {rec_in.status.value}.{status_note}"
        notify_user(
            db,
            user_id=emp.user_id,
            title=alert_title,
            message=alert_msg,
            notif_type=NotificationType.ATTENDANCE,
            link="/attendance",
        )

    db.commit()
    db.refresh(res_rec)
    return _to_attendance_response(res_rec)


@router.put("/{attendance_id}", response_model=AttendanceResponse)
def update_attendance_record(
    attendance_id: int,
    upd: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Update an existing attendance record.
    Restricted to ADMIN and HR.
    """
    record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attendance record with ID {attendance_id} not found",
        )

    if upd.check_in is not None:
        record.check_in = upd.check_in
    if upd.check_out is not None:
        record.check_out = upd.check_out
    if upd.status is not None:
        record.status = upd.status
    if upd.notes is not None:
        record.notes = upd.notes

    if upd.working_hours is not None:
        record.working_hours = upd.working_hours
    elif record.check_in and record.check_out:
        delta = record.check_out - record.check_in
        record.working_hours = round(Decimal(delta.total_seconds()) / Decimal(3600.0), 2)

    if upd.overtime_hours is not None:
        record.overtime_hours = upd.overtime_hours
    elif record.working_hours is not None:
        record.overtime_hours = max(Decimal("0.00"), record.working_hours - Decimal("8.00"))

    # Recalculate late and early departure if shift exists
    shift = record.shift
    if shift and record.check_in:
        shift_start = shift.start_time
        deadline = datetime.combine(record.date, shift_start) + timedelta(minutes=shift.grace_period_minutes)
        if record.check_in > deadline:
            record.is_late = True
            record.late_minutes = max(1, int((record.check_in - datetime.combine(record.date, shift_start)).total_seconds() / 60))
        else:
            record.is_late = False
            record.late_minutes = 0

    if shift and record.check_out:
        if shift.is_overnight or shift.start_time > shift.end_time:
            scheduled_end_dt = datetime.combine(record.date + timedelta(days=1), shift.end_time)
        else:
            scheduled_end_dt = datetime.combine(record.date, shift.end_time)

        if record.check_out < scheduled_end_dt:
            record.is_early_departure = True
            record.early_departure_minutes = max(1, int((scheduled_end_dt - record.check_out).total_seconds() / 60))
        else:
            record.is_early_departure = False
            record.early_departure_minutes = 0

    if record.employee and record.employee.user_id:
        notify_user(
            db,
            user_id=record.employee.user_id,
            title="Attendance Record Adjusted",
            message=f"Your attendance record for {record.date} was updated to {record.status.value} ({record.working_hours or 0} hrs) by HR/Admin.",
            notif_type=NotificationType.ATTENDANCE,
            link="/attendance",
            related_entity_id=record.id,
            prevent_duplicate=True,
        )

    db.commit()
    db.refresh(record)
    return _to_attendance_response(record)


@router.post("/auto-absent", response_model=AutoAbsentResponse)
def run_auto_absent(
    target_date: Optional[date] = Query(None, description="Target date to mark absent (must be a completed workday)."),
    dry_run: bool = Query(True, description="When true, previews changes without writing to database."),
    custom_holidays: Optional[str] = Query(None, description="Optional comma-separated ISO dates (YYYY-MM-DD) to treat as public holidays."),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    On-demand API endpoint for HR/Admin to execute or dry-run automatic absent marking.
    - Prevents duplicate attendance records.
    - Preserves existing attendance (never overwrites).
    - Skips employees on approved leave.
    - Rejects weekends and public holidays.
    - Rejects future dates.
    """
    from app.attendance_tasks import mark_absent_employees

    holidays = [h.strip() for h in custom_holidays.split(",")] if custom_holidays else None

    try:
        details = mark_absent_employees(
            work_date=target_date,
            dry_run=dry_run,
            holidays=holidays,
            return_details=True,
        )
        return AutoAbsentResponse(**details)

    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
