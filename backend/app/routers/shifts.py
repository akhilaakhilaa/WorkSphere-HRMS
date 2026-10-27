from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_employee, get_current_user, require_roles
from app.models.employee import Employee
from app.models.shift import EmployeeShift, Shift
from app.models.user import User, UserRole
from app.schemas.shift import (
    EmployeeShiftAssignRequest,
    EmployeeShiftResponse,
    EmployeeShiftUpdateRequest,
    ShiftCreate,
    ShiftResponse,
    ShiftUpdate,
)

router = APIRouter(prefix="/shifts", tags=["Module 14: Shift Management"])


def _to_shift_response(s: Shift, db: Session) -> ShiftResponse:
    active_count = (
        db.query(EmployeeShift)
        .filter(EmployeeShift.shift_id == s.id, EmployeeShift.is_active == True)
        .count()
    )
    return ShiftResponse(
        id=s.id,
        name=s.name,
        start_time=s.start_time,
        end_time=s.end_time,
        description=s.description,
        grace_period_minutes=s.grace_period_minutes,
        is_overnight=s.is_overnight,
        created_at=s.created_at,
        updated_at=s.updated_at,
        active_employees_count=active_count,
    )


def _to_assignment_response(ea: EmployeeShift) -> EmployeeShiftResponse:
    emp = ea.employee
    sh = ea.shift
    return EmployeeShiftResponse(
        id=ea.id,
        employee_id=ea.employee_id,
        employee_name=emp.full_name if emp else None,
        department=emp.department if emp else None,
        designation=emp.designation if emp else None,
        shift_id=ea.shift_id,
        shift_name=sh.name if sh else None,
        start_time=sh.start_time if sh else None,
        end_time=sh.end_time if sh else None,
        is_overnight=sh.is_overnight if sh else False,
        grace_period_minutes=sh.grace_period_minutes if sh else 15,
        start_date=ea.start_date,
        end_date=ea.end_date,
        is_active=ea.is_active,
        created_at=ea.created_at,
        updated_at=ea.updated_at,
    )


# -------------------------------------------------------------
# SHIFT COLLECTION ENDPOINTS
# -------------------------------------------------------------


@router.post("", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
def create_shift(
    shift_in: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Create a new organization shift.
    Supports overnight shifts (start_time > end_time).
    Restricted to ADMIN and HR.
    """
    # 1. Check duplicate name
    existing = db.query(Shift).filter(Shift.name == shift_in.name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A shift named '{shift_in.name}' already exists.",
        )

    # 2. Check identical start & end time
    if shift_in.start_time == shift_in.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shift start_time and end_time cannot be identical.",
        )

    is_overnight = shift_in.start_time > shift_in.end_time

    new_shift = Shift(
        name=shift_in.name.strip(),
        start_time=shift_in.start_time,
        end_time=shift_in.end_time,
        description=shift_in.description.strip() if shift_in.description else None,
        grace_period_minutes=shift_in.grace_period_minutes,
        is_overnight=is_overnight,
    )
    db.add(new_shift)
    db.commit()
    db.refresh(new_shift)

    return _to_shift_response(new_shift, db)


@router.get("", response_model=List[ShiftResponse])
def list_shifts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all organization shifts.
    Accessible to all authenticated users.
    """
    shifts = db.query(Shift).order_by(Shift.start_time.asc()).all()
    return [_to_shift_response(s, db) for s in shifts]


# -------------------------------------------------------------
# EMPLOYEE SHIFT ASSIGNMENT ENDPOINTS
# (Must be declared before /{shift_id} to prevent path parameter collision)
# -------------------------------------------------------------


@router.post("/assign", response_model=EmployeeShiftResponse, status_code=status.HTTP_201_CREATED)
def assign_shift_to_employee(
    req: EmployeeShiftAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Assign a shift to an employee.
    Deactivates any previous active shift assignment to prevent conflicts.
    Restricted to ADMIN and HR.
    """
    emp = db.query(Employee).filter(Employee.id == req.employee_id).first()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee #{req.employee_id} not found.",
        )

    shift = db.query(Shift).filter(Shift.id == req.shift_id).first()
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift #{req.shift_id} not found.",
        )

    start_date = req.start_date or date.today()

    if req.end_date and req.end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment end_date cannot be earlier than start_date.",
        )

    # Deactivate existing active shift assignments if the new assignment is active
    if req.is_active:
        existing_active = (
            db.query(EmployeeShift)
            .filter(
                EmployeeShift.employee_id == req.employee_id,
                EmployeeShift.is_active == True,
            )
            .all()
        )
        for old in existing_active:
            old.is_active = False
            if old.end_date is None or old.end_date >= start_date:
                old.end_date = start_date

    new_assignment = EmployeeShift(
        employee_id=req.employee_id,
        shift_id=req.shift_id,
        start_date=start_date,
        end_date=req.end_date,
        is_active=req.is_active,
    )
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)

    return _to_assignment_response(new_assignment)


@router.get("/assignments", response_model=List[EmployeeShiftResponse])
def list_shift_assignments(
    employee_id: Optional[int] = Query(None),
    shift_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List shift assignments.
    - ADMIN and HR can view all assignments or filter by employee/shift/active.
    - Regular EMPLOYEE can only view their own shift assignments.
    """
    query = db.query(EmployeeShift).join(Shift, Shift.id == EmployeeShift.shift_id)

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee record not found.")
        query = query.filter(EmployeeShift.employee_id == emp.id)
    else:
        if employee_id:
            query = query.filter(EmployeeShift.employee_id == employee_id)

    if shift_id:
        query = query.filter(EmployeeShift.shift_id == shift_id)

    if is_active is not None:
        query = query.filter(EmployeeShift.is_active == is_active)

    assignments = query.order_by(EmployeeShift.is_active.desc(), EmployeeShift.start_date.desc()).all()
    return [_to_assignment_response(a) for a in assignments]


@router.get("/employee/{employee_id}", response_model=EmployeeShiftResponse)
def get_employee_current_shift(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the currently active shift assignment for a specific employee.
    - ADMIN and HR can view any employee's shift.
    - EMPLOYEE can only view their own shift.
    """
    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or emp.id != employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own shift assignment.",
            )

    active_shift = (
        db.query(EmployeeShift)
        .filter(
            EmployeeShift.employee_id == employee_id,
            EmployeeShift.is_active == True,
        )
        .first()
    )

    if not active_shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active shift assignment found for employee #{employee_id}.",
        )

    return _to_assignment_response(active_shift)


@router.put("/assignments/{assignment_id}", response_model=EmployeeShiftResponse)
def update_shift_assignment(
    assignment_id: int,
    upd: EmployeeShiftUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Update an existing shift assignment.
    Restricted to ADMIN and HR.
    """
    assignment = db.query(EmployeeShift).filter(EmployeeShift.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment #{assignment_id} not found.",
        )

    if upd.shift_id:
        shift = db.query(Shift).filter(Shift.id == upd.shift_id).first()
        if not shift:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Shift #{upd.shift_id} not found.",
            )
        assignment.shift_id = upd.shift_id

    if upd.start_date:
        assignment.start_date = upd.start_date

    if upd.end_date is not None:
        if upd.end_date and upd.end_date < assignment.start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignment end_date cannot be earlier than start_date.",
            )
        assignment.end_date = upd.end_date

    if upd.is_active is not None:
        if upd.is_active and not assignment.is_active:
            # Deactivate other active assignments for this employee
            other_active = (
                db.query(EmployeeShift)
                .filter(
                    EmployeeShift.employee_id == assignment.employee_id,
                    EmployeeShift.id != assignment.id,
                    EmployeeShift.is_active == True,
                )
                .all()
            )
            for o in other_active:
                o.is_active = False
        assignment.is_active = upd.is_active

    db.commit()
    db.refresh(assignment)
    return _to_assignment_response(assignment)


@router.delete("/assignments/{assignment_id}")
def delete_shift_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Remove an employee shift assignment.
    Restricted to ADMIN and HR.
    """
    assignment = db.query(EmployeeShift).filter(EmployeeShift.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment #{assignment_id} not found.",
        )

    db.delete(assignment)
    db.commit()

    return {
        "message": f"Assignment #{assignment_id} successfully removed.",
        "deleted_assignment_id": assignment_id,
    }


# -------------------------------------------------------------
# INDIVIDUAL SHIFT ENDPOINTS
# -------------------------------------------------------------


@router.get("/{shift_id}", response_model=ShiftResponse)
def get_shift_details(
    shift_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get detailed information for a specific shift.
    Accessible to all authenticated users.
    """
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift #{shift_id} not found.",
        )
    return _to_shift_response(shift, db)


@router.put("/{shift_id}", response_model=ShiftResponse)
def update_shift(
    shift_id: int,
    shift_upd: ShiftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Update shift details (times, grace period, name, description).
    Restricted to ADMIN and HR.
    """
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift #{shift_id} not found.",
        )

    if shift_upd.name and shift_upd.name.strip() != shift.name:
        dup = (
            db.query(Shift)
            .filter(Shift.name == shift_upd.name.strip(), Shift.id != shift.id)
            .first()
        )
        if dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A shift named '{shift_upd.name}' already exists.",
            )
        shift.name = shift_upd.name.strip()

    new_start = shift_upd.start_time or shift.start_time
    new_end = shift_upd.end_time or shift.end_time

    if new_start == new_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shift start_time and end_time cannot be identical.",
        )

    shift.start_time = new_start
    shift.end_time = new_end
    shift.is_overnight = new_start > new_end

    if shift_upd.description is not None:
        shift.description = shift_upd.description.strip() if shift_upd.description else None

    if shift_upd.grace_period_minutes is not None:
        shift.grace_period_minutes = shift_upd.grace_period_minutes

    db.commit()
    db.refresh(shift)
    return _to_shift_response(shift, db)


@router.delete("/{shift_id}")
def delete_shift(
    shift_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Delete a shift.
    Safeguard: Rejects deletion if active employee shift assignments exist.
    Restricted to ADMIN and HR.
    """
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift #{shift_id} not found.",
        )

    active_count = (
        db.query(EmployeeShift)
        .filter(EmployeeShift.shift_id == shift_id, EmployeeShift.is_active == True)
        .count()
    )
    if active_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete shift '{shift.name}' because {active_count} employee(s) "
                "currently have active assignments to it. Reassign or remove employee shift assignments first."
            ),
        )

    shift_name = shift.name
    db.delete(shift)
    db.commit()

    return {
        "message": f"Shift '{shift_name}' (ID #{shift_id}) has been successfully deleted.",
        "deleted_shift_id": shift_id,
    }

