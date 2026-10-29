"""
Resignation & Exit Management Router
WorkSphere HRMS - Module 22
"""

from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_current_employee, require_roles
from app.models.employee import Employee
from app.models.notification import NotificationType
from app.models.resignation import Resignation, ResignationStatus
from app.models.user import User, UserRole
from app.schemas.resignation import (
    ResignationCreate,
    ResignationResponse,
    ResignationReview,
    ResignationSummary,
)
from app.utils.notifications import notify_admins_and_hr, notify_user

router = APIRouter(prefix="/resignations", tags=["Module 22: Resignation & Exit Management"])


def _to_resignation_response(r: Resignation) -> ResignationResponse:
    """Helper to convert Resignation ORM to ResignationResponse Pydantic schema."""
    emp = r.employee
    reviewer = r.reviewer
    return ResignationResponse(
        id=r.id,
        employee_id=r.employee_id,
        employee_name=emp.full_name if emp else None,
        employee_code=f"EMP{emp.id:03d}" if emp else None,
        department=emp.department if emp else None,
        reason=r.reason,
        notice_period=r.notice_period,
        status=r.status,
        last_working_day=r.last_working_day,
        reviewed_by=r.reviewed_by,
        reviewer_email=reviewer.email if reviewer else None,
        reviewed_at=r.reviewed_at,
        reviewer_comments=r.reviewer_comments,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


# --------------------------------------------------------------------------
# 1. Submit Resignation Request
# --------------------------------------------------------------------------
@router.post("", response_model=ResignationResponse, status_code=status.HTTP_201_CREATED)
def submit_resignation(
    resignation_in: ResignationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a new resignation request.
    Employees submit for themselves. HR and Admin may submit for an employee by providing employee_id.
    """
    # 1. Determine target employee
    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee profile not found for this user account.",
            )
        target_employee_id = emp.id
    else:
        # HR or Admin
        if resignation_in.employee_id:
            emp = db.query(Employee).filter(Employee.id == resignation_in.employee_id).first()
            if not emp:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee #{resignation_in.employee_id} not found.",
                )
            target_employee_id = emp.id
        else:
            emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
            if not emp:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Please provide an employee_id for the resignation request.",
                )
            target_employee_id = emp.id

    # 2. Validate reason & notice period
    clean_reason = resignation_in.reason.strip()
    if len(clean_reason) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resignation reason must be at least 5 characters long.",
        )

    if resignation_in.notice_period < 1 or resignation_in.notice_period > 180:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notice period must be between 1 and 180 days.",
        )

    # 3. Check for existing active or pending resignation requests (Prevent duplicates)
    pending_res = (
        db.query(Resignation)
        .filter(
            Resignation.employee_id == target_employee_id,
            Resignation.status == ResignationStatus.PENDING,
        )
        .first()
    )
    if pending_res:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending resignation request under review.",
        )

    approved_res = (
        db.query(Resignation)
        .filter(
            Resignation.employee_id == target_employee_id,
            Resignation.status == ResignationStatus.APPROVED,
        )
        .first()
    )
    if approved_res:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an approved resignation request on record.",
        )

    # 4. Calculate proposed last working day (today + notice period)
    today = date.today()
    calculated_last_day = today + timedelta(days=resignation_in.notice_period)

    # 5. Create Resignation record
    new_resignation = Resignation(
        employee_id=target_employee_id,
        reason=clean_reason,
        notice_period=resignation_in.notice_period,
        status=ResignationStatus.PENDING,
        last_working_day=calculated_last_day,
    )
    db.add(new_resignation)
    db.commit()
    db.refresh(new_resignation)

    # 6. Notify HR and Admins
    notify_admins_and_hr(
        db=db,
        title="New Resignation Request",
        message=(
            f"{emp.full_name} ({emp.department}) submitted a resignation request "
            f"with a {resignation_in.notice_period}-day notice period. Proposed last day: {calculated_last_day}."
        ),
        notif_type=NotificationType.SYSTEM,
        link="/resignations",
    )

    return _to_resignation_response(new_resignation)


# --------------------------------------------------------------------------
# 2. Retrieve Logged-in Employee's Resignation Requests
# --------------------------------------------------------------------------
@router.get("/my", response_model=List[ResignationResponse])
@router.get("/me", response_model=List[ResignationResponse])
def get_my_resignations(
    status_filter: Optional[ResignationStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all resignation requests for the authenticated employee.
    """
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        # If HR/Admin user without an employee record
        return []

    query = db.query(Resignation).filter(Resignation.employee_id == emp.id)
    if status_filter:
        query = query.filter(Resignation.status == status_filter)

    records = query.order_by(Resignation.id.desc()).all()
    return [_to_resignation_response(r) for r in records]


# --------------------------------------------------------------------------
# 3. Retrieve Summary Metrics
# --------------------------------------------------------------------------
@router.get("/summary", response_model=ResignationSummary)
def get_resignation_summary(
    employee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve resignation summary counts (total, pending, approved, rejected).
    Employees get their own counts; HR/Admin get organization-wide counts.
    """
    query = db.query(Resignation)

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            return ResignationSummary(total_requests=0, pending=0, approved=0, rejected=0)
        query = query.filter(Resignation.employee_id == emp.id)
    elif employee_id:
        query = query.filter(Resignation.employee_id == employee_id)

    records = query.all()
    total_requests = len(records)
    pending = sum(1 for r in records if r.status == ResignationStatus.PENDING)
    approved = sum(1 for r in records if r.status == ResignationStatus.APPROVED)
    rejected = sum(1 for r in records if r.status == ResignationStatus.REJECTED)

    return ResignationSummary(
        total_requests=total_requests,
        pending=pending,
        approved=approved,
        rejected=rejected,
    )


# --------------------------------------------------------------------------
# 4. List Resignation Requests (HR/Admin & Scoped)
# --------------------------------------------------------------------------
@router.get("", response_model=List[ResignationResponse])
def list_resignations(
    status_filter: Optional[ResignationStatus] = Query(None, alias="status"),
    employee_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve resignation requests.
    - Employees are strictly isolated to their own requests.
    - HR and Admin can retrieve requests for all employees with filtering.
    """
    query = db.query(Resignation)

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            return []

        # If employee explicitly tried to query another employee's records
        if employee_id is not None and employee_id != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You can only view your own resignation requests.",
            )

        query = query.filter(Resignation.employee_id == emp.id)
    else:
        # HR and Admin
        if employee_id:
            query = query.filter(Resignation.employee_id == employee_id)

    if status_filter:
        query = query.filter(Resignation.status == status_filter)

    records = query.order_by(Resignation.id.desc()).offset(skip).limit(limit).all()
    return [_to_resignation_response(r) for r in records]


# --------------------------------------------------------------------------
# 5. Retrieve Specific Resignation Request
# --------------------------------------------------------------------------
@router.get("/{resignation_id}", response_model=ResignationResponse)
def get_resignation_detail(
    resignation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve a specific resignation request by ID.
    Enforces strict employee data isolation.
    """
    resignation = db.query(Resignation).filter(Resignation.id == resignation_id).first()
    if not resignation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resignation request #{resignation_id} not found.",
        )

    # Data Isolation Check for regular employees
    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or resignation.employee_id != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You can only view your own resignation request.",
            )

    return _to_resignation_response(resignation)


# --------------------------------------------------------------------------
# 6. Approve or Reject Resignation Request
# --------------------------------------------------------------------------
@router.patch("/{resignation_id}/review", response_model=ResignationResponse)
@router.put("/{resignation_id}/review", response_model=ResignationResponse)
def review_resignation(
    resignation_id: int,
    review_in: ResignationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Review a pending resignation request (Approve or Reject).
    - Restricted to HR and Admin roles.
    - Prevents self-review (employees cannot approve/reject their own request).
    - Prevents invalid status transitions and duplicate processing.
    """
    # 1. Role Authorization Check
    if current_user.role not in (UserRole.HR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only HR and Admin users can approve or reject resignation requests.",
        )

    # 2. Check existence
    resignation = db.query(Resignation).filter(Resignation.id == resignation_id).first()
    if not resignation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resignation request #{resignation_id} not found.",
        )

    # 3. Self-Review Safeguard
    caller_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if caller_emp and caller_emp.id == resignation.employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-review forbidden: You cannot approve or reject your own resignation request.",
        )

    # 4. Status Transition Safeguards (Prevent duplicate processing & invalid transitions)
    if resignation.status == ResignationStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resignation request has already been approved and cannot be modified.",
        )

    if resignation.status == ResignationStatus.REJECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resignation request has already been rejected and cannot be modified.",
        )

    if resignation.status != ResignationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending resignation requests can be reviewed.",
        )

    if review_in.status not in (ResignationStatus.APPROVED, ResignationStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Review status must be either APPROVED or REJECTED.",
        )

    # 5. Apply review
    resignation.status = review_in.status
    resignation.reviewed_by = current_user.id
    resignation.reviewed_at = datetime.now()
    if review_in.reviewer_comments is not None:
        resignation.reviewer_comments = review_in.reviewer_comments.strip()

    if review_in.last_working_day:
        resignation.last_working_day = review_in.last_working_day

    db.commit()
    db.refresh(resignation)

    # 6. Notify Employee
    if resignation.employee and resignation.employee.user_id:
        status_label = "Approved" if review_in.status == ResignationStatus.APPROVED else "Rejected"
        comments_note = f" Notes: {review_in.reviewer_comments}" if review_in.reviewer_comments else ""
        notify_user(
            db=db,
            user_id=resignation.employee.user_id,
            title=f"Resignation Request {status_label}",
            message=(
                f"Your resignation request has been {status_label.lower()} by {current_user.email}."
                f"{comments_note}"
            ),
            notif_type=NotificationType.SYSTEM,
            link="/resignations",
            related_entity_id=resignation.id,
            prevent_duplicate=True,
        )

    return _to_resignation_response(resignation)


# --------------------------------------------------------------------------
# 7. Cancel / Delete Resignation Request
# --------------------------------------------------------------------------
@router.delete("/{resignation_id}", status_code=status.HTTP_200_OK)
def delete_resignation(
    resignation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cancel or delete a pending resignation request.
    - Employees can only cancel their own PENDING requests.
    - HR and Admin can delete any resignation request.
    """
    resignation = db.query(Resignation).filter(Resignation.id == resignation_id).first()
    if not resignation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resignation request #{resignation_id} not found.",
        )

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or resignation.employee_id != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot delete another employee's resignation request.",
            )
        if resignation.status != ResignationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can only cancel resignation requests that are currently PENDING.",
            )

    db.delete(resignation)
    db.commit()
    return {"message": f"Resignation request #{resignation_id} deleted successfully."}
