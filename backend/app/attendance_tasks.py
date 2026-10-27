from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Iterable, Set

from sqlalchemy import or_

from app.config import PUBLIC_HOLIDAYS
from app.database import SessionLocal
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.leave import Leave, LeaveStatus
from app.models.shift import EmployeeShift


def get_configured_holidays(
    custom_holidays: Iterable[date | str] | None = None,
) -> Set[date]:
    """
    Return a set of public holiday date objects.
    Defaults to the globally configured PUBLIC_HOLIDAYS from app.config.
    """
    if custom_holidays is not None:
        result: Set[date] = set()
        for h in custom_holidays:
            if isinstance(h, date):
                result.add(h)
            elif isinstance(h, str):
                try:
                    result.add(date.fromisoformat(h.strip()))
                except ValueError:
                    pass
        return result
    return set(PUBLIC_HOLIDAYS)


def is_weekend(target_date: date) -> bool:
    """Check if the given date falls on a weekend (Saturday or Sunday)."""
    return target_date.weekday() >= 5


def is_public_holiday(
    target_date: date,
    holidays: Iterable[date | str] | None = None,
) -> bool:
    """Check if the given date is a configured public holiday."""
    holiday_set = get_configured_holidays(holidays)
    return target_date in holiday_set


def is_workday(
    target_date: date,
    holidays: Iterable[date | str] | None = None,
) -> bool:
    """Check if the given date is a valid working day (neither weekend nor public holiday)."""
    return not is_weekend(target_date) and not is_public_holiday(target_date, holidays)


def get_completed_workday(
    ref_date: date | None = None,
    cutoff_hour: int = 18,
    holidays: Iterable[date | str] | None = None,
) -> date:
    """
    Determine the most recent completed workday.
    - If ref_date is provided and is a workday, return it; otherwise walk backwards to the previous workday.
    - If ref_date is None:
      - If current time is on or after cutoff_hour (default 18:00 / 6 PM) and today is a workday, today is completed.
      - Otherwise, walk backwards starting from yesterday to find the previous completed workday.
    """
    if ref_date is not None:
        d = ref_date
        while not is_workday(d, holidays):
            d -= timedelta(days=1)
        return d

    now = datetime.now()
    today = now.date()

    if now.hour >= cutoff_hour and is_workday(today, holidays):
        return today

    d = today - timedelta(days=1)
    while not is_workday(d, holidays):
        d -= timedelta(days=1)
    return d


def mark_absent_employees(
    work_date: date | None = None,
    dry_run: bool = True,
    holidays: Iterable[date | str] | None = None,
    return_details: bool = False,
) -> int | dict:
    """
    Mark active employees absent for a completed workday
    if they have no attendance record and no approved leave.

    - Skips employees with existing attendance records (never overwrites).
    - Skips employees with approved leave covering the date.
    - Excludes weekends and public holidays.
    - dry_run=True previews changes without modifying the database.

    Returns the number of employees marked absent (or a detailed dict if return_details=True).
    """
    if work_date is None:
        work_date = get_completed_workday(holidays=holidays)

    # Reject future dates, weekends, and public holidays
    if work_date > date.today():
        raise ValueError("Cannot mark future attendance as absent.")

    if is_weekend(work_date):
        raise ValueError(f"Cannot automatically mark weekend attendance absent ({work_date}).")

    if is_public_holiday(work_date, holidays):
        raise ValueError(f"Cannot automatically mark public holiday ({work_date}) attendance absent.")

    db = SessionLocal()
    marked_count = 0
    skipped_logged = 0
    skipped_leave = 0

    try:
        employees = (
            db.query(Employee)
            .filter(Employee.status == EmployeeStatus.ACTIVE)
            .all()
        )
        total_employees = len(employees)

        for employee in employees:
            # Skip employees who already have an attendance record
            existing = (
                db.query(Attendance)
                .filter(
                    Attendance.employee_id == employee.id,
                    Attendance.date == work_date,
                )
                .first()
            )

            if existing:
                skipped_logged += 1
                continue

            # Skip employees with approved leave covering this date
            approved_leave = (
                db.query(Leave)
                .filter(
                    Leave.employee_id == employee.id,
                    Leave.status == LeaveStatus.APPROVED,
                    Leave.start_date <= work_date,
                    Leave.end_date >= work_date,
                )
                .first()
            )

            if approved_leave:
                skipped_leave += 1
                continue

            marked_count += 1

            if not dry_run:
                # Query active shift for this employee on work_date
                active_shift_id = None
                active_emp_shift = (
                    db.query(EmployeeShift)
                    .filter(
                        EmployeeShift.employee_id == employee.id,
                        EmployeeShift.is_active.is_(True),
                        EmployeeShift.start_date <= work_date,
                        or_(
                            EmployeeShift.end_date.is_(None),
                            EmployeeShift.end_date >= work_date,
                        ),
                    )
                    .first()
                )
                if active_emp_shift:
                    active_shift_id = active_emp_shift.shift_id

                db.add(
                    Attendance(
                        employee_id=employee.id,
                        shift_id=active_shift_id,
                        date=work_date,
                        status=AttendanceStatus.ABSENT,
                        working_hours=Decimal("0.00"),
                        overtime_hours=Decimal("0.00"),
                        notes=(
                            "Automatically marked absent: "
                            "no attendance record found."
                        ),
                    )
                )

        if dry_run:
            db.rollback()
        else:
            db.commit()

        if return_details:
            action_desc = "would be marked absent (dry run preview)" if dry_run else "newly marked absent"
            return {
                "target_date": work_date,
                "dry_run": dry_run,
                "marked_count": marked_count,
                "marked_absent_count": marked_count,
                "total_employees_evaluated": total_employees,
                "skipped_already_logged": skipped_logged,
                "skipped_on_leave": skipped_leave,
                "skipped_non_workday": False,
                "message": f"{marked_count} employee(s) {action_desc} for {work_date}.",
            }

        return marked_count

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()
