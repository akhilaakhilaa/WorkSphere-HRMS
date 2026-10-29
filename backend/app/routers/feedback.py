"""
Employee Feedback Router
WorkSphere HRMS - Module 26
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.feedback import Feedback
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.schemas.feedback import (
    FeedbackCreate,
    FeedbackEmployeeInfo,
    FeedbackResponse,
    FeedbackSummary,
    RatingCount,
)
from app.utils.notifications import notify_admins_and_hr

router = APIRouter(prefix="/feedback", tags=["Module 26: Employee Feedback System"])


def _to_feedback_response(fb: Feedback) -> FeedbackResponse:
    emp = fb.employee
    emp_info = None
    if emp:
        emp_info = FeedbackEmployeeInfo(
            id=emp.id,
            full_name=emp.full_name,
            department=emp.department,
            designation=emp.designation,
        )
    return FeedbackResponse(
        id=fb.id,
        employee_id=fb.employee_id,
        employee=emp_info,
        message=fb.message,
        rating=fb.rating,
        created_at=fb.created_at,
    )


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submits feedback with 1-5 rating and comment.
    Automatically resolves employee_id from authenticated user session.
    """
    emp = current_user.employee
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit feedback: No associated employee profile found for your account.",
        )

    if not (1 <= payload.rating <= 5):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rating must be an integer between 1 and 5.",
        )

    clean_message = payload.message.strip()
    if not clean_message:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Feedback message cannot be empty.",
        )

    fb = Feedback(
        employee_id=emp.id,
        message=clean_message,
        rating=payload.rating,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)

    # Notify HR and Admin users
    try:
        notify_admins_and_hr(
            db=db,
            title="New Employee Feedback",
            message=f"{emp.full_name} submitted a {fb.rating}-star review.",
            notif_type=NotificationType.SYSTEM,
            link="/feedback",
            related_entity_id=fb.id,
            prevent_duplicate=False,
        )
        db.commit()
    except Exception:
        db.rollback()

    return _to_feedback_response(fb)


@router.get("/summary", response_model=FeedbackSummary)
def get_feedback_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Returns high-level feedback metrics for HR and Admin:
    Total submissions, average rating score, and breakdown by star rating.
    """
    total = db.query(func.count(Feedback.id)).scalar() or 0
    avg_score = db.query(func.avg(Feedback.rating)).scalar()
    average_rating = round(float(avg_score), 2) if avg_score is not None else 0.0

    counts_by_rating = dict(
        db.query(Feedback.rating, func.count(Feedback.id))
        .group_by(Feedback.rating)
        .all()
    )

    breakdown = [
        RatingCount(rating=r, count=counts_by_rating.get(r, 0))
        for r in range(5, 0, -1)
    ]

    return FeedbackSummary(
        total_feedback=total,
        average_rating=average_rating,
        rating_breakdown=breakdown,
    )


@router.get("", response_model=List[FeedbackResponse])
def list_feedback(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists feedback submissions.
    - Admins and HR can view all feedback records.
    - Employees can only view their own submissions.
    """
    query = db.query(Feedback).order_by(Feedback.created_at.desc())

    if current_user.role not in (UserRole.ADMIN, UserRole.HR):
        emp = current_user.employee
        if not emp:
            return []
        query = query.filter(Feedback.employee_id == emp.id)

    records = query.all()
    return [_to_feedback_response(r) for r in records]


@router.get("/{feedback_id}", response_model=FeedbackResponse)
def get_feedback_by_id(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves a specific feedback entry by ID.
    Enforces authorization check for employee users.
    """
    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Feedback #{feedback_id} not found.",
        )

    if current_user.role not in (UserRole.ADMIN, UserRole.HR):
        emp = current_user.employee
        if not emp or fb.employee_id != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot view feedback submitted by another employee.",
            )

    return _to_feedback_response(fb)

