"""
Profile & Settings Router
WorkSphere HRMS - Module 27
Handles Personal Profile, Password Change, and Notification Preferences.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.employee import Employee
from app.models.preference import UserNotificationPreference
from app.models.user import User
from app.schemas.profile import (
    ChangePasswordRequest,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    ProfileResponse,
    ProfileUpdate,
)
from app.utils.security import hash_password, verify_password

router = APIRouter(prefix="/profile", tags=["Module 27: Profile & Settings"])


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Returns full personal profile of the currently logged-in user.
    Reuses existing User and Employee models without duplicating database tables.
    """
    emp = current_user.employee
    return ProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        employee_id=emp.id if emp else None,
        full_name=emp.full_name if emp else None,
        department=emp.department if emp else None,
        designation=emp.designation if emp else None,
        joining_date=emp.joining_date if emp else None,
        salary=float(emp.salary) if emp and emp.salary is not None else None,
        status=emp.status.value if emp and hasattr(emp.status, "value") else (str(emp.status) if emp else None),
    )


@router.put("/me", response_model=ProfileResponse)
def update_my_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Allows the user to update safe personal profile information (name, email).
    Protected against privilege escalation (role, salary, and status cannot be modified here).
    """
    if payload.email and payload.email != current_user.email:
        # Check uniqueness
        existing = db.query(User).filter(User.email == payload.email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use by another account.",
            )
        current_user.email = payload.email

    if payload.full_name:
        emp = current_user.employee
        if emp:
            emp.full_name = payload.full_name.strip()

    db.commit()
    db.refresh(current_user)

    return get_my_profile(current_user=current_user)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Secure password change endpoint.
    - Validates current password using Argon2id.
    - Enforces confirmation matching and minimum length.
    - Prevents reusing the same current password.
    """
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation do not match.",
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    if payload.new_password == payload.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be the same as current password.",
        )

    # Hash and save new password
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password updated successfully."}


@router.get("/preferences", response_model=NotificationPreferenceResponse)
def get_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves the user's notification preferences.
    Returns safe default values (all enabled) if no preferences record exists.
    """
    pref = (
        db.query(UserNotificationPreference)
        .filter(UserNotificationPreference.user_id == current_user.id)
        .first()
    )
    if not pref:
        return NotificationPreferenceResponse(
            in_app_enabled=True,
            email_enabled=True,
            notify_leaves=True,
            notify_attendance=True,
            notify_tasks=True,
            notify_announcements=True,
            notify_payroll=True,
        )

    return NotificationPreferenceResponse(
        in_app_enabled=pref.in_app_enabled,
        email_enabled=pref.email_enabled,
        notify_leaves=pref.notify_leaves,
        notify_attendance=pref.notify_attendance,
        notify_tasks=pref.notify_tasks,
        notify_announcements=pref.notify_announcements,
        notify_payroll=pref.notify_payroll,
    )


@router.put("/preferences", response_model=NotificationPreferenceResponse)
def update_notification_preferences(
    payload: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates notification delivery and category preferences for the logged-in user.
    Creates preference record if it does not yet exist.
    """
    pref = (
        db.query(UserNotificationPreference)
        .filter(UserNotificationPreference.user_id == current_user.id)
        .first()
    )

    if not pref:
        pref = UserNotificationPreference(
            user_id=current_user.id,
            in_app_enabled=payload.in_app_enabled if payload.in_app_enabled is not None else True,
            email_enabled=payload.email_enabled if payload.email_enabled is not None else True,
            notify_leaves=payload.notify_leaves if payload.notify_leaves is not None else True,
            notify_attendance=payload.notify_attendance if payload.notify_attendance is not None else True,
            notify_tasks=payload.notify_tasks if payload.notify_tasks is not None else True,
            notify_announcements=payload.notify_announcements if payload.notify_announcements is not None else True,
            notify_payroll=payload.notify_payroll if payload.notify_payroll is not None else True,
        )
        db.add(pref)
    else:
        if payload.in_app_enabled is not None:
            pref.in_app_enabled = payload.in_app_enabled
        if payload.email_enabled is not None:
            pref.email_enabled = payload.email_enabled
        if payload.notify_leaves is not None:
            pref.notify_leaves = payload.notify_leaves
        if payload.notify_attendance is not None:
            pref.notify_attendance = payload.notify_attendance
        if payload.notify_tasks is not None:
            pref.notify_tasks = payload.notify_tasks
        if payload.notify_announcements is not None:
            pref.notify_announcements = payload.notify_announcements
        if payload.notify_payroll is not None:
            pref.notify_payroll = payload.notify_payroll

    db.commit()
    db.refresh(pref)

    return NotificationPreferenceResponse(
        in_app_enabled=pref.in_app_enabled,
        email_enabled=pref.email_enabled,
        notify_leaves=pref.notify_leaves,
        notify_attendance=pref.notify_attendance,
        notify_tasks=pref.notify_tasks,
        notify_announcements=pref.notify_announcements,
        notify_payroll=pref.notify_payroll,
    )

