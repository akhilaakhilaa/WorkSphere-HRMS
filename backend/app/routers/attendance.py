from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_employee, get_current_user, require_roles
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.schemas.attendance import (
    AttendanceManualRecord,
    AttendanceResponse,
    AttendanceSummary,
    AttendanceUpdate,
    CheckInRequest,
    CheckOutRequest,
)
from app.utils.notifications import notify_admins_and_hr, notify_user

router = APIRouter(prefix="/attendance", tags=["Attendance Management"])


def _to_attendance_response(att: Attendance) -> AttendanceResponse:
    return AttendanceResponse(
        id=att.id,
        employee_id=att.employee_id,
        employee_name=att.employee.full_name if att.employee else None,
        date=att.date,
        check_in=att.check_in,
        check_out=att.check_out,
        working_hours=att.working_hours,
        status=att.status,
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
    Prevents duplicate check-ins.
    """
    today = date.today()
    record = (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee.id, Attendance.date == today)
        .first()
    )

    if record and record.check_in:
        time_str = record.check_in.strftime("%H:%M:%S")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Duplicate check-in: You have already checked in today at {time_str}.",
        )

    now = datetime.now()

    if record:
        record.check_in = now
        record.status = AttendanceStatus.PRESENT
        if check_in_data and check_in_data.notes:
            record.notes = (
                f"{record.notes}\nCheck-in note: {check_in_data.notes}"
                if record.notes
                else check_in_data.notes
            )
    else:
        record = Attendance(
            employee_id=employee.id,
            date=today,
            check_in=now,
            status=AttendanceStatus.PRESENT,
            notes=check_in_data.notes if check_in_data else None,
        )
        db.add(record)

    # Attendance Alert: Notify employee of check-in and late arrival if applicable
    if employee.user_id:
        is_late = now.hour > 9 or (now.hour == 9 and now.minute > 30)
        time_str = now.strftime("%I:%M %p")
        if is_late:
            notify_user(
                db,
                user_id=employee.user_id,
                title="Late Attendance Alert",
                message=f"You checked in at {time_str} on {today}, which is recorded after the standard 09:30 AM shift start.",
                notif_type=NotificationType.ATTENDANCE,
                link="/attendance",
            )
        else:
            notify_user(
                db,
                user_id=employee.user_id,
                title="Attendance Checked In",
                message=f"You successfully checked in today ({today}) at {time_str}.",
                notif_type=NotificationType.ATTENDANCE,
                link="/attendance",
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
    Check-out for the current authenticated employee for today.
    Prevents invalid check-outs (must check in first, cannot check out twice).
    Calculates working hours and updates status (PRESENT, HALF_DAY).
    """
    today = date.today()
    record = (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee.id, Attendance.date == today)
        .first()
    )

    if not record or not record.check_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid check-out: No check-in record found for today. You must check in first.",
        )

    if record.check_out:
        time_str = record.check_out.strftime("%H:%M:%S")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid check-out: You have already checked out today at {time_str}.",
        )

    now = datetime.now()
    delta = now - record.check_in
    hours = max(Decimal("0.00"), round(Decimal(delta.total_seconds()) / Decimal(3600.0), 2))

    # Determine status according to hours worked
    # >= 8.0 hours is PRESENT, >= 4.0 hours is HALF_DAY, else HALF_DAY
    if hours >= Decimal("8.00"):
        new_status = AttendanceStatus.PRESENT
    elif hours >= Decimal("4.00"):
        new_status = AttendanceStatus.HALF_DAY
    else:
        new_status = AttendanceStatus.HALF_DAY

    record.check_out = now
    record.working_hours = hours
    record.status = new_status

    if check_out_data and check_out_data.notes:
        record.notes = (
            f"{record.notes}\nCheck-out note: {check_out_data.notes}"
            if record.notes
            else check_out_data.notes
        )

    # Attendance Alert: Notify employee of check-out and short hours if applicable
    if employee.user_id:
        time_str = now.strftime("%I:%M %p")
        if hours < Decimal("8.00"):
            notify_user(
                db,
                user_id=employee.user_id,
                title="Short Hours Attendance Alert",
                message=f"You checked out at {time_str} with {hours} working hours (Standard is 8.0 hrs). Status marked as {new_status.value}.",
                notif_type=NotificationType.ATTENDANCE,
                link="/attendance",
            )
        else:
            notify_user(
                db,
                user_id=employee.user_id,
                title="Attendance Checked Out",
                message=f"You checked out today at {time_str}. Total hours: {hours} hrs (Status: {new_status.value}).",
                notif_type=NotificationType.ATTENDANCE,
                link="/attendance",
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
        .filter(Attendance.employee_id == employee.id, Attendance.date == today)
        .first()
    )
    if not record:
        return None
    return _to_attendance_response(record)


@router.get("/my-history", response_model=List[AttendanceResponse])
def get_my_attendance_history(
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=365),
):
    """Returns attendance history for the currently logged-in employee."""
    records = (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee.id)
        .order_by(Attendance.date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_to_attendance_response(r) for r in records]


@router.get("/summary", response_model=AttendanceSummary)
def get_attendance_summary(
    employee_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns attendance summary counts.
    Regular employees can only view their own summary.
    HR and ADMIN can view any employee's summary or company-wide summary.
    """
    target_emp_id = None
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

    return AttendanceSummary(
        total_records=total_records,
        present_days=present_days,
        half_days=half_days,
        absent_days=absent_days,
        total_hours=round(total_hours, 2),
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
    Manually record or override attendance for an employee (e.g. marked ABSENT or manual check-in).
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

    if existing:
        existing.check_in = rec_in.check_in
        existing.check_out = rec_in.check_out
        existing.working_hours = working_hours
        existing.status = rec_in.status
        existing.notes = rec_in.notes
        res_rec = existing
    else:
        new_record = Attendance(
            employee_id=rec_in.employee_id,
            date=rec_in.date,
            check_in=rec_in.check_in,
            check_out=rec_in.check_out,
            working_hours=working_hours,
            status=rec_in.status,
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

    if record.employee and record.employee.user_id:
        notify_user(
            db,
            user_id=record.employee.user_id,
            title="Attendance Record Adjusted",
            message=f"Your attendance record for {record.date} was updated to {record.status.value} ({record.working_hours or 0} hrs) by HR/Admin.",
            notif_type=NotificationType.ATTENDANCE,
            link="/attendance",
        )

    db.commit()
    db.refresh(record)
    return _to_attendance_response(record)


