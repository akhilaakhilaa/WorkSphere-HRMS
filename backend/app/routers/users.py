from datetime import date
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models.attendance import Attendance
from app.models.employee import Employee, EmployeeStatus
from app.models.leave import Leave, LeaveBalance
from app.models.payroll import Payroll
from app.models.user import User, UserRole
from app.schemas.user import (
    UserAdminCreate,
    UserDetailResponse,
    UserResponse,
    UserRoleUpdate,
    UserStatusUpdate,
    UserUpdate,
)
from app.utils.security import hash_password

router = APIRouter(prefix="/users", tags=["Module 13: Admin Controls & User Management"])


def _to_user_response(u: User, db: Session) -> UserResponse:
    emp = db.query(Employee).filter(Employee.user_id == u.id).first()
    return UserResponse(
        id=u.id,
        username=u.username,
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        created_at=u.created_at,
        updated_at=u.updated_at,
        employee_id=emp.id if emp else None,
        full_name=emp.full_name if emp else None,
        department=emp.department if emp else None,
        designation=emp.designation if emp else None,
        employee_status=emp.status.value if emp else None,
    )


@router.get("", response_model=List[UserResponse])
def list_users(
    q: Optional[str] = Query(None, description="Search by username, email, or employee full name"),
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """
    List all system user accounts with optional search and filtering.
    Restricted strictly to administrators.
    """
    query = db.query(User).outerjoin(Employee, Employee.user_id == User.id)

    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            (User.username.ilike(search_pattern))
            | (User.email.ilike(search_pattern))
            | (Employee.full_name.ilike(search_pattern))
        )

    if role:
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    users = query.order_by(User.id.asc()).offset(skip).limit(limit).all()
    return [_to_user_response(u, db) for u in users]


@router.get("/{user_id}", response_model=UserDetailResponse)
def get_user_details(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """
    Retrieve comprehensive details for a specific user, including associated business records count.
    Restricted strictly to administrators.
    """
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User #{user_id} not found",
        )

    emp = db.query(Employee).filter(Employee.user_id == u.id).first()
    att_count = db.query(Attendance).filter(Attendance.employee_id == emp.id).count() if emp else 0
    leave_count = db.query(Leave).filter(Leave.employee_id == emp.id).count() if emp else 0
    payroll_count = db.query(Payroll).filter(Payroll.employee_id == emp.id).count() if emp else 0
    notif_count = len(u.notifications) if u.notifications else 0

    # Determine if safely deletable:
    # Cannot delete if it is the only active admin or has business records
    is_only_admin = False
    if u.role == UserRole.ADMIN and u.is_active:
        other_admins = (
            db.query(User)
            .filter(User.role == UserRole.ADMIN, User.is_active == True, User.id != u.id)
            .count()
        )
        if other_admins == 0:
            is_only_admin = True

    can_delete = not is_only_admin and (att_count == 0 and leave_count == 0 and payroll_count == 0)

    return UserDetailResponse(
        id=u.id,
        username=u.username,
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        created_at=u.created_at,
        updated_at=u.updated_at,
        employee_id=emp.id if emp else None,
        full_name=emp.full_name if emp else None,
        department=emp.department if emp else None,
        designation=emp.designation if emp else None,
        employee_status=emp.status.value if emp else None,
        attendance_records_count=att_count,
        leave_requests_count=leave_count,
        payroll_records_count=payroll_count,
        notifications_count=notif_count,
        can_delete=can_delete,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserAdminCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """
    Create a new user account with role, active status, and optional employee association.
    Restricted strictly to administrators.
    """
    # 1. Uniqueness checks
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A user with email '{user_in.email}' already exists",
        )

    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{user_in.username}' is already taken",
        )

    # 2. Check employee link if requested
    existing_emp = None
    if user_in.employee_id:
        existing_emp = db.query(Employee).filter(Employee.id == user_in.employee_id).first()
        if not existing_emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee #{user_in.employee_id} not found",
            )
        if existing_emp.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee #{user_in.employee_id} ({existing_emp.full_name}) is already linked to user #{existing_emp.user_id}",
            )

    # 3. Create user
    new_user = User(
        username=user_in.username.strip().lower(),
        email=user_in.email.strip().lower(),
        password_hash=hash_password(user_in.password),
        role=user_in.role,
        is_active=user_in.is_active,
    )
    db.add(new_user)
    db.flush()

    # 4. Handle employee link or creation
    if existing_emp:
        existing_emp.user_id = new_user.id
    elif user_in.create_employee:
        if not (user_in.full_name and user_in.department and user_in.designation and user_in.salary is not None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="full_name, department, designation, and salary are required when create_employee is enabled",
            )
        new_emp = Employee(
            user_id=new_user.id,
            full_name=user_in.full_name.strip(),
            department=user_in.department.strip(),
            designation=user_in.designation.strip(),
            salary=user_in.salary,
            joining_date=user_in.joining_date or date.today(),
            status=EmployeeStatus.ACTIVE,
        )
        db.add(new_emp)

    db.commit()
    db.refresh(new_user)
    return _to_user_response(new_user, db)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_upd: UserUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """
    Update permitted user fields (username, email, role, status, password, employee link).
    Enforces safeguards on the last active administrator.
    Restricted strictly to administrators.
    """
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User #{user_id} not found",
        )

    # Check username uniqueness if changed
    if user_upd.username and user_upd.username.strip().lower() != u.username:
        new_username = user_upd.username.strip().lower()
        if db.query(User).filter(User.username == new_username, User.id != u.id).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{new_username}' is already taken",
            )
        u.username = new_username

    # Check email uniqueness if changed
    if user_upd.email and user_upd.email.strip().lower() != u.email:
        new_email = user_upd.email.strip().lower()
        if db.query(User).filter(User.email == new_email, User.id != u.id).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{new_email}' is already in use",
            )
        u.email = new_email

    # Last active admin safeguards
    if u.role == UserRole.ADMIN and u.is_active:
        is_changing_away_from_admin = user_upd.role and user_upd.role != UserRole.ADMIN
        is_deactivating = user_upd.is_active is False
        if is_changing_away_from_admin or is_deactivating:
            other_admins = (
                db.query(User)
                .filter(User.role == UserRole.ADMIN, User.is_active == True, User.id != u.id)
                .count()
            )
            if other_admins == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot deactivate or change the role of the only active administrator. Ensure another active administrator exists first.",
                )

    if user_upd.role:
        u.role = user_upd.role

    if user_upd.is_active is not None:
        u.is_active = user_upd.is_active

    if user_upd.password:
        u.password_hash = hash_password(user_upd.password)

    # Handle employee link
    if user_upd.employee_id is not None:
        if user_upd.employee_id <= 0:
            # Unlink existing employee
            current_emp = db.query(Employee).filter(Employee.user_id == u.id).first()
            if current_emp:
                current_emp.user_id = None
        else:
            target_emp = db.query(Employee).filter(Employee.id == user_upd.employee_id).first()
            if not target_emp:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee #{user_upd.employee_id} not found",
                )
            if target_emp.user_id and target_emp.user_id != u.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Employee #{target_emp.id} is already linked to user #{target_emp.user_id}",
                )
            # Unlink previous employee if any
            prev_emp = db.query(Employee).filter(Employee.user_id == u.id).first()
            if prev_emp and prev_emp.id != target_emp.id:
                prev_emp.user_id = None
            target_emp.user_id = u.id

    db.commit()
    db.refresh(u)
    return _to_user_response(u, db)


@router.patch("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role_upd: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """
    Change a user's role (EMPLOYEE, HR, ADMIN).
    Prevents demoting the last active administrator.
    Restricted strictly to administrators.
    """
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User #{user_id} not found",
        )

    # Safeguard: cannot remove admin role if user is the last active admin
    if u.role == UserRole.ADMIN and role_upd.role != UserRole.ADMIN and u.is_active:
        other_admins = (
            db.query(User)
            .filter(User.role == UserRole.ADMIN, User.is_active == True, User.id != u.id)
            .count()
        )
        if other_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change the role of the only active administrator. Ensure another active administrator exists before changing this role.",
            )

    u.role = role_upd.role
    db.commit()
    db.refresh(u)
    return _to_user_response(u, db)


@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    status_upd: UserStatusUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """
    Activate or deactivate a user account.
    Prevents deactivating the last active administrator.
    Restricted strictly to administrators.
    """
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User #{user_id} not found",
        )

    # Safeguard: cannot deactivate last active admin
    if u.role == UserRole.ADMIN and not status_upd.is_active and u.is_active:
        other_admins = (
            db.query(User)
            .filter(User.role == UserRole.ADMIN, User.is_active == True, User.id != u.id)
            .count()
        )
        if other_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the only active administrator. Ensure another active administrator exists before deactivating this account.",
            )

    u.is_active = status_upd.is_active
    db.commit()
    db.refresh(u)
    return _to_user_response(u, db)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """
    Delete a user account only when safe.
    Safeguards:
    1. Blocks deleting the last active administrator.
    2. Blocks deleting users who have linked employee attendance, leave, or payroll history.
    Restricted strictly to administrators.
    """
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User #{user_id} not found",
        )

    # Safeguard 1: Last active admin
    if u.role == UserRole.ADMIN and u.is_active:
        other_admins = (
            db.query(User)
            .filter(User.role == UserRole.ADMIN, User.is_active == True, User.id != u.id)
            .count()
        )
        if other_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the only active administrator.",
            )

    # Safeguard 2: Linked employee historical records preservation
    emp = db.query(Employee).filter(Employee.user_id == u.id).first()
    if emp:
        att_count = db.query(Attendance).filter(Attendance.employee_id == emp.id).count()
        leave_count = db.query(Leave).filter(Leave.employee_id == emp.id).count()
        payroll_count = db.query(Payroll).filter(Payroll.employee_id == emp.id).count()
        balance_count = db.query(LeaveBalance).filter(LeaveBalance.employee_id == emp.id).count()

        if att_count > 0 or leave_count > 0 or payroll_count > 0 or balance_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete user '{u.username}' because linked employee '{emp.full_name}' has existing attendance ({att_count}), leave ({leave_count}), or payroll ({payroll_count}) history. Please deactivate the user account instead to preserve organizational data integrity.",
            )
        # If employee has no records, unlink safely
        emp.user_id = None

    username_deleted = u.username
    user_id_deleted = u.id

    db.delete(u)
    db.commit()

    return {
        "message": f"User '{username_deleted}' (ID #{user_id_deleted}) has been safely deleted.",
        "deleted_user_id": user_id_deleted,
    }

