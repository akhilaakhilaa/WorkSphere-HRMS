from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_employee, get_current_user, require_roles
from app.models.employee import Employee
from app.models.leave import Leave, LeaveStatus, LeaveType
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.schemas.leave import (
    LeaveCreate,
    LeaveResponse,
    LeaveReview,
    LeaveSummary,
)
from app.utils.notifications import notify_admins_and_hr, notify_user

router = APIRouter(prefix="/leaves", tags=["Module 4: Leave Management"])


def _to_leave_response(leave: Leave) -> LeaveResponse:
    reviewer_email = leave.reviewer.email if leave.reviewer else None
    employee_name = leave.employee.full_name if leave.employee else None
    department = leave.employee.department if leave.employee else None

    return LeaveResponse(
        id=leave.id,
        employee_id=leave.employee_id,
        employee_name=employee_name,
        department=department,
        leave_type=leave.leave_type,
        start_date=leave.start_date,
        end_date=leave.end_date,
        total_days=leave.total_days,
        reason=leave.reason,
        status=leave.status,
        admin_remarks=leave.admin_remarks,
        reviewed_by=leave.reviewed_by,
        reviewer_email=reviewer_email,
        reviewed_at=leave.reviewed_at,
        created_at=leave.created_at,
        updated_at=leave.updated_at,
    )


@router.post("", response_model=LeaveResponse, status_code=status.HTTP_201_CREATED)
def apply_leave(
    leave_in: LeaveCreate,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    Apply for a leave of absence.
    Accessible to authenticated employees.
    """
    if leave_in.end_date < leave_in.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be earlier than start date",
        )

    # Check for overlapping pending or approved leave requests
    overlapping = (
        db.query(Leave)
        .filter(
            Leave.employee_id == employee.id,
            Leave.status.in_([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
            Leave.start_date <= leave_in.end_date,
            Leave.end_date >= leave_in.start_date,
        )
        .first()
    )
    if overlapping:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Overlapping leave request already exists from {overlapping.start_date} to {overlapping.end_date} (Status: {overlapping.status.value})",
        )

    total_days = (leave_in.end_date - leave_in.start_date).days + 1

    new_leave = Leave(
        employee_id=employee.id,
        leave_type=leave_in.leave_type,
        start_date=leave_in.start_date,
        end_date=leave_in.end_date,
        total_days=total_days,
        reason=leave_in.reason.strip(),
        status=LeaveStatus.PENDING,
    )
    db.add(new_leave)
    db.flush()

    # Notifications-ready: alert HR and Admins
    notify_admins_and_hr(
        db,
        title="New Leave Application",
        message=f"{employee.full_name} ({employee.department}) requested {total_days} days {leave_in.leave_type.value} leave from {leave_in.start_date} to {leave_in.end_date}.",
        notif_type=NotificationType.LEAVE,
        link="/leaves",
    )

    db.commit()
    db.refresh(new_leave)
    return _to_leave_response(new_leave)


@router.get("/my-history", response_model=List[LeaveResponse])
def get_my_leave_history(
    employee: Employee = Depends(get_current_employee),
    status_filter: Optional[LeaveStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    """Returns the current authenticated employee's leave applications history."""
    query = db.query(Leave).filter(Leave.employee_id == employee.id)
    if status_filter:
        query = query.filter(Leave.status == status_filter)

    leaves = query.order_by(Leave.id.desc()).all()
    return [_to_leave_response(l) for l in leaves]


@router.get("/summary", response_model=LeaveSummary)
def get_leave_summary(
    employee_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns leave request metrics.
    Employees view their own; HR/Admin can view any employee or organization-wide.
    """
    query = db.query(Leave)
    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee profile not found")
        query = query.filter(Leave.employee_id == emp.id)
    elif employee_id:
        query = query.filter(Leave.employee_id == employee_id)

    records = query.all()
    total_requests = len(records)
    pending = sum(1 for r in records if r.status == LeaveStatus.PENDING)
    approved = sum(1 for r in records if r.status == LeaveStatus.APPROVED)
    rejected = sum(1 for r in records if r.status == LeaveStatus.REJECTED)
    cancelled = sum(1 for r in records if r.status == LeaveStatus.CANCELLED)

    return LeaveSummary(
        total_requests=total_requests,
        pending=pending,
        approved=approved,
        rejected=rejected,
        cancelled=cancelled,
    )


@router.get("", response_model=List[LeaveResponse])
def list_organization_leaves(
    status_filter: Optional[LeaveStatus] = Query(None, alias="status"),
    leave_type: Optional[LeaveType] = Query(None),
    employee_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    List organization-wide leave applications.
    Restricted to ADMIN and HR roles.
    """
    query = db.query(Leave)
    if status_filter:
        query = query.filter(Leave.status == status_filter)
    if leave_type:
        query = query.filter(Leave.leave_type == leave_type)
    if employee_id:
        query = query.filter(Leave.employee_id == employee_id)

    leaves = query.order_by(Leave.id.desc()).offset(skip).limit(limit).all()
    return [_to_leave_response(l) for l in leaves]


@router.get("/{leave_id}", response_model=LeaveResponse)
def get_leave_details(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single leave request details."""
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Leave request with ID {leave_id} not found",
        )

    # Permission check: regular employees can only inspect their own leaves
    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or leave.employee_id != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this leave request",
            )

    return _to_leave_response(leave)


@router.put("/{leave_id}/review", response_model=LeaveResponse)
def review_leave(
    leave_id: int,
    review_in: LeaveReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Approve or reject a leave application.
    Restricted to ADMIN and HR roles.
    """
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Leave request with ID {leave_id} not found",
        )

    if review_in.status not in [LeaveStatus.APPROVED, LeaveStatus.REJECTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Review status must be APPROVED or REJECTED",
        )

    leave.status = review_in.status
    leave.admin_remarks = review_in.admin_remarks
    leave.reviewed_by = current_user.id
    leave.reviewed_at = datetime.now()

    # Notifications-ready: Notify the employee of approval/rejection
    if leave.employee and leave.employee.user_id:
        status_label = "Approved" if review_in.status == LeaveStatus.APPROVED else "Rejected"
        notify_user(
            db,
            user_id=leave.employee.user_id,
            title=f"Leave Request {status_label}",
            message=f"Your {leave.leave_type.value} leave ({leave.start_date} to {leave.end_date}) was {status_label.lower()} by {current_user.email}."
            + (f" Note: {review_in.admin_remarks}" if review_in.admin_remarks else ""),
            notif_type=NotificationType.LEAVE,
            link="/leaves",
        )

    db.commit()
    db.refresh(leave)
    return _to_leave_response(leave)


@router.put("/{leave_id}/cancel", response_model=LeaveResponse)
def cancel_leave(
    leave_id: int,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    Cancel an employee's own pending leave request.
    """
    leave = (
        db.query(Leave)
        .filter(Leave.id == leave_id, Leave.employee_id == employee.id)
        .first()
    )
    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Leave application #{leave_id} not found for current employee",
        )

    if leave.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a leave with status '{leave.status.value}'. Only PENDING leaves can be cancelled.",
        )

    leave.status = LeaveStatus.CANCELLED

    # Notify Admins and HR of cancellation
    notify_admins_and_hr(
        db,
        title="Leave Request Cancelled",
        message=f"{employee.full_name} cancelled their {leave.leave_type.value} leave request ({leave.start_date} to {leave.end_date}).",
        notif_type=NotificationType.LEAVE,
        link="/leaves",
    )

    db.commit()
    db.refresh(leave)
    return _to_leave_response(leave)

