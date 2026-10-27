from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.performance import PerformanceReview
from app.models.user import User, UserRole
from app.schemas.performance import (
    RATING_LABELS,
    PerformanceReviewCreate,
    PerformanceReviewResponse,
    PerformanceReviewUpdate,
    PerformanceSummary,
)

router = APIRouter(prefix="/performance", tags=["Performance Management"])


def serialize_review(review: PerformanceReview) -> PerformanceReviewResponse:
    """Helper to convert PerformanceReview ORM object into response DTO."""
    emp = review.employee
    reviewer = review.reviewer
    return PerformanceReviewResponse(
        id=review.id,
        employee_id=review.employee_id,
        employee_name=emp.full_name if emp else None,
        employee_designation=emp.designation if emp else None,
        employee_department=emp.department if emp else None,
        reviewer_id=review.reviewer_id,
        reviewer_name=reviewer.username if reviewer else None,
        review_period=review.review_period,
        rating=review.rating,
        rating_label=RATING_LABELS.get(review.rating, "Unknown"),
        feedback=review.feedback,
        goals=review.goals,
        created_at=review.created_at,
        updated_at=review.updated_at,
    )


# -------------------------------------------------------------
# 1. CREATE PERFORMANCE REVIEW
# -------------------------------------------------------------
@router.post(
    "",
    response_model=PerformanceReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_performance_review(
    review_in: PerformanceReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Create a new performance review.
    - Restricted to HR and ADMIN roles.
    - Validates target employee exists.
    - Enforces uniqueness: at most one review per employee per review period.
    """
    # 1. Verify target employee exists
    target_employee = (
        db.query(Employee).filter(Employee.id == review_in.employee_id).first()
    )
    if not target_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee #{review_in.employee_id} not found.",
        )

    # 2. Check for duplicate review for the same period
    existing = (
        db.query(PerformanceReview)
        .filter(
            PerformanceReview.employee_id == review_in.employee_id,
            PerformanceReview.review_period == review_in.review_period,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"A performance review already exists for employee #{review_in.employee_id} "
                f"in period '{review_in.review_period}'. Please update the existing review instead."
            ),
        )

    # 3. Create review record
    new_review = PerformanceReview(
        employee_id=review_in.employee_id,
        reviewer_id=current_user.id,
        review_period=review_in.review_period,
        rating=review_in.rating,
        feedback=review_in.feedback,
        goals=review_in.goals,
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)

    return serialize_review(new_review)


# -------------------------------------------------------------
# 2. LIST PERFORMANCE REVIEWS
# -------------------------------------------------------------
@router.get("", response_model=List[PerformanceReviewResponse])
def list_performance_reviews(
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
    review_period: Optional[str] = Query(None, description="Filter by review period"),
    rating: Optional[int] = Query(None, ge=1, le=5, description="Filter by rating (1-5)"),
    search: Optional[str] = Query(None, description="Search by employee name or feedback"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List performance reviews with role-based visibility:
    - EMPLOYEE: can only view their own performance reviews.
    - HR / ADMIN: can view all reviews or filter by employee/period/rating/search.
    """
    query = db.query(PerformanceReview)

    # Role enforcement
    if current_user.role == UserRole.EMPLOYEE:
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp:
            return []
        if employee_id is not None and employee_id != my_emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own performance reviews.",
            )
        query = query.filter(PerformanceReview.employee_id == my_emp.id)
    else:
        # HR or ADMIN
        if employee_id:
            query = query.filter(PerformanceReview.employee_id == employee_id)

    # Apply filters
    if review_period:
        query = query.filter(PerformanceReview.review_period == review_period)

    if rating:
        query = query.filter(PerformanceReview.rating == rating)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.join(Employee, PerformanceReview.employee_id == Employee.id).filter(
            or_(
                Employee.full_name.ilike(term),
                PerformanceReview.feedback.ilike(term),
                PerformanceReview.goals.ilike(term),
            )
        )

    reviews = query.order_by(PerformanceReview.created_at.desc()).all()
    return [serialize_review(r) for r in reviews]


# -------------------------------------------------------------
# 3. GET PERFORMANCE SUMMARY METRICS
# -------------------------------------------------------------
@router.get("/summary", response_model=PerformanceSummary)
def get_performance_summary(
    employee_id: Optional[int] = Query(None, description="Scope summary to employee ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get aggregated summary metrics for performance reviews:
    - Total reviews
    - Average rating
    - Distinct employees reviewed
    - Rating breakdown (1-5)
    - Period breakdown
    """
    query = db.query(PerformanceReview)

    if current_user.role == UserRole.EMPLOYEE:
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp:
            return PerformanceSummary(
                total_reviews=0,
                average_rating=0.0,
                employees_reviewed=0,
                rating_distribution={str(k): 0 for k in range(1, 6)},
                period_breakdown={},
            )
        query = query.filter(PerformanceReview.employee_id == my_emp.id)
    else:
        if employee_id:
            query = query.filter(PerformanceReview.employee_id == employee_id)

    reviews = query.all()
    total_reviews = len(reviews)
    avg_rating = (
        round(sum(r.rating for r in reviews) / total_reviews, 2)
        if total_reviews > 0
        else 0.0
    )
    distinct_emps = len(set(r.employee_id for r in reviews))

    rating_dist = {str(k): 0 for k in range(1, 6)}
    period_dist = {}

    for r in reviews:
        r_key = str(r.rating)
        rating_dist[r_key] = rating_dist.get(r_key, 0) + 1
        period_dist[r.review_period] = period_dist.get(r.review_period, 0) + 1

    return PerformanceSummary(
        total_reviews=total_reviews,
        average_rating=avg_rating,
        employees_reviewed=distinct_emps,
        rating_distribution=rating_dist,
        period_breakdown=period_dist,
    )


# -------------------------------------------------------------
# 4. GET PERFORMANCE HISTORY FOR SPECIFIC EMPLOYEE
# -------------------------------------------------------------
@router.get(
    "/employee/{employee_id}",
    response_model=List[PerformanceReviewResponse],
)
def get_employee_performance_history(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all historical performance reviews for a specific employee.
    - EMPLOYEE: can only retrieve their own history (403 otherwise).
    - HR / ADMIN: can view any employee's history.
    """
    target_emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not target_emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee #{employee_id} not found.",
        )

    if current_user.role == UserRole.EMPLOYEE:
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp or my_emp.id != employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot view another employee's performance history.",
            )

    reviews = (
        db.query(PerformanceReview)
        .filter(PerformanceReview.employee_id == employee_id)
        .order_by(PerformanceReview.review_period.desc(), PerformanceReview.created_at.desc())
        .all()
    )
    return [serialize_review(r) for r in reviews]


# -------------------------------------------------------------
# 5. GET INDIVIDUAL REVIEW DETAILS
# -------------------------------------------------------------
@router.get("/{review_id}", response_model=PerformanceReviewResponse)
def get_performance_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve a single performance review by ID.
    - Enforces ownership for EMPLOYEE role.
    """
    review = (
        db.query(PerformanceReview).filter(PerformanceReview.id == review_id).first()
    )
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Performance review #{review_id} not found.",
        )

    if current_user.role == UserRole.EMPLOYEE:
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp or review.employee_id != my_emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own performance reviews.",
            )

    return serialize_review(review)


# -------------------------------------------------------------
# 6. UPDATE PERFORMANCE REVIEW
# -------------------------------------------------------------
@router.put("/{review_id}", response_model=PerformanceReviewResponse)
def update_performance_review(
    review_id: int,
    review_in: PerformanceReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an existing performance review.
    - Restricted to HR and ADMIN roles.
    - Prevents period collisions for the same employee.
    - Updates reviewer_id to record modifier.
    """
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Employees cannot modify performance reviews.",
        )

    review = (
        db.query(PerformanceReview).filter(PerformanceReview.id == review_id).first()
    )
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Performance review #{review_id} not found.",
        )

    # If review_period is changing, check for collision
    if (
        review_in.review_period is not None
        and review_in.review_period != review.review_period
    ):
        collision = (
            db.query(PerformanceReview)
            .filter(
                PerformanceReview.employee_id == review.employee_id,
                PerformanceReview.review_period == review_in.review_period,
                PerformanceReview.id != review_id,
            )
            .first()
        )
        if collision:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"A performance review already exists for employee #{review.employee_id} "
                    f"in period '{review_in.review_period}'."
                ),
            )
        review.review_period = review_in.review_period

    if review_in.rating is not None:
        review.rating = review_in.rating

    if review_in.feedback is not None:
        review.feedback = review_in.feedback

    if review_in.goals is not None:
        review.goals = review_in.goals

    review.reviewer_id = current_user.id
    db.commit()
    db.refresh(review)

    return serialize_review(review)


# -------------------------------------------------------------
# 7. DELETE PERFORMANCE REVIEW
# -------------------------------------------------------------
@router.delete("/{review_id}")
def delete_performance_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a performance review.
    - Restricted to HR and ADMIN roles.
    """
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Employees cannot delete performance reviews.",
        )

    review = (
        db.query(PerformanceReview).filter(PerformanceReview.id == review_id).first()
    )
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Performance review #{review_id} not found.",
        )

    db.delete(review)
    db.commit()

    return {
        "message": f"Performance review #{review_id} deleted successfully.",
        "id": review_id,
    }

