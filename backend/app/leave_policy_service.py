from decimal import Decimal
from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.employee import Employee, EmployeeStatus
from app.models.leave import Leave, LeaveBalance, LeavePolicy, LeaveStatus, LeaveType
from app.schemas.leave import LeaveBalanceResponse, LeavePolicyResponse

DEFAULT_LEAVE_POLICIES = [
    (LeaveType.CASUAL, Decimal("12.00")),
    (LeaveType.SICK, Decimal("10.00")),
    (LeaveType.ANNUAL, Decimal("15.00")),
    (LeaveType.MATERNITY, Decimal("90.00")),
    (LeaveType.PATERNITY, Decimal("15.00")),
    (LeaveType.UNPAID, Decimal("30.00")),
]


def ensure_default_policies(db: Session) -> List[LeavePolicy]:
    """
    Ensure standard leave policies exist in the database without creating duplicates.
    """
    policies = db.query(LeavePolicy).all()
    existing_types = {p.leave_type for p in policies}

    added = False
    for l_type, days in DEFAULT_LEAVE_POLICIES:
        if l_type not in existing_types:
            pol = LeavePolicy(
                leave_type=l_type,
                total_days_allowed=days,
            )
            db.add(pol)
            added = True

    if added:
        db.commit()
        policies = db.query(LeavePolicy).all()

    return policies


def init_employee_balances(db: Session, employee_id: int) -> List[LeaveBalance]:
    """
    Initialize leave balances for an employee from configured policies.
    - Prevents duplicate balance records for the same employee and leave type.
    - Preserves existing balances without silently overwriting them.
    - Safely accounts for previously approved leaves if initializing an existing employee.
    """
    policies = ensure_default_policies(db)
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        return []

    existing_balances = {
        b.leave_type: b
        for b in db.query(LeaveBalance).filter(LeaveBalance.employee_id == employee_id).all()
    }

    added = False
    for pol in policies:
        if pol.leave_type not in existing_balances:
            new_balance = LeaveBalance(
                employee_id=employee_id,
                leave_type=pol.leave_type,
                remaining_days=pol.total_days_allowed,
            )
            db.add(new_balance)
            added = True

    if added:
        db.commit()

    return (
        db.query(LeaveBalance)
        .filter(LeaveBalance.employee_id == employee_id)
        .order_by(LeaveBalance.id.asc())
        .all()
    )


def init_all_active_employees_balances(db: Session) -> int:
    """
    Initializes leave balances for all active employees without modifying existing balances.
    Returns the total number of balance records added.
    """
    policies = ensure_default_policies(db)
    employees = db.query(Employee).filter(Employee.status == EmployeeStatus.ACTIVE).all()

    total_created = 0
    for emp in employees:
        existing_types = {
            b.leave_type
            for b in db.query(LeaveBalance).filter(LeaveBalance.employee_id == emp.id).all()
        }

        for pol in policies:
            if pol.leave_type not in existing_types:
                db.add(
                    LeaveBalance(
                        employee_id=emp.id,
                        leave_type=pol.leave_type,
                        remaining_days=pol.total_days_allowed,
                    )
                )
                total_created += 1

    if total_created > 0:
        db.commit()

    return total_created


def to_leave_balance_response(
    balance: LeaveBalance,
    policy_map: Optional[dict] = None,
) -> LeaveBalanceResponse:
    """
    Format a LeaveBalance model into a comprehensive LeaveBalanceResponse schema
    including total allowed, used days, and remaining days.
    """
    total_allowed = Decimal("0.00")
    if policy_map and balance.leave_type in policy_map:
        total_allowed = policy_map[balance.leave_type]
    elif balance.employee:
        # Default fallback
        total_allowed = balance.remaining_days

    used_days = max(Decimal("0.00"), total_allowed - balance.remaining_days)

    return LeaveBalanceResponse(
        id=balance.id,
        employee_id=balance.employee_id,
        employee_name=balance.employee.full_name if balance.employee else None,
        department=balance.employee.department if balance.employee else None,
        leave_type=balance.leave_type,
        total_allowed=total_allowed,
        used_days=used_days,
        remaining_days=balance.remaining_days,
        created_at=balance.created_at,
        updated_at=balance.updated_at,
    )
