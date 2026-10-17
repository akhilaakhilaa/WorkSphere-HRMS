from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_employee, get_current_user, require_roles
from app.models.employee import Employee, EmployeeStatus
from app.models.notification import NotificationType
from app.models.payroll import PaymentMethod, PaymentStatus, Payroll
from app.models.user import User, UserRole
from app.schemas.payroll import (
    PayrollCreate,
    PayrollGenerateRequest,
    PayrollResponse,
    PayrollSummary,
    PayrollUpdate,
)
from app.utils.notifications import notify_admins_and_hr, notify_user

router = APIRouter(prefix="/payroll", tags=["Module 5: Payroll Management"])


def _to_payroll_response(p: Payroll) -> PayrollResponse:
    return PayrollResponse(
        id=p.id,
        employee_id=p.employee_id,
        employee_name=p.employee.full_name if p.employee else None,
        department=p.employee.department if p.employee else None,
        designation=p.employee.designation if p.employee else None,
        month=p.month,
        year=p.year,
        base_salary=p.base_salary,
        allowances=p.allowances,
        bonuses=p.bonuses,
        deductions=p.deductions,
        tax_deduction=p.tax_deduction,
        net_salary=p.net_salary,
        payment_status=p.payment_status,
        payment_date=p.payment_date,
        payment_method=p.payment_method,
        notes=p.notes,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


@router.post("/generate", response_model=List[PayrollResponse], status_code=status.HTTP_201_CREATED)
def generate_payroll(
    gen_req: PayrollGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Generate payroll for a specific month and year.
    If employee_id is supplied, generates for that employee.
    If employee_id is omitted, generates for all ACTIVE employees.
    Calculates monthly base, standard 10% tax deduction, and net salary.
    Restricted to ADMIN and HR.
    """
    if gen_req.employee_id:
        targets = (
            db.query(Employee).filter(Employee.id == gen_req.employee_id).all()
        )
        if not targets:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {gen_req.employee_id} not found",
            )
    else:
        targets = (
            db.query(Employee)
            .filter(Employee.status == EmployeeStatus.ACTIVE)
            .all()
        )

    if not targets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No eligible active employees found for payroll generation",
        )

    created_payrolls = []
    skipped_existing = 0

    for emp in targets:
        existing = (
            db.query(Payroll)
            .filter(
                Payroll.employee_id == emp.id,
                Payroll.month == gen_req.month,
                Payroll.year == gen_req.year,
            )
            .first()
        )
        if existing:
            skipped_existing += 1
            created_payrolls.append(existing)
            continue

        # Monthly base salary = Annual Salary / 12
        monthly_base = round(Decimal(emp.salary) / Decimal(12), 2)
        allowances = Decimal("0.00")
        bonuses = Decimal("0.00")
        deductions = Decimal("0.00")
        # Standard estimated tax: 10% of monthly base
        tax_deduction = round(monthly_base * Decimal("0.10"), 2)
        net_salary = monthly_base + allowances + bonuses - (deductions + tax_deduction)

        new_payroll = Payroll(
            employee_id=emp.id,
            month=gen_req.month,
            year=gen_req.year,
            base_salary=monthly_base,
            allowances=allowances,
            bonuses=bonuses,
            deductions=deductions,
            tax_deduction=tax_deduction,
            net_salary=net_salary,
            payment_status=PaymentStatus.PENDING,
            payment_method=PaymentMethod.BANK_TRANSFER,
            notes=f"Auto-generated payroll for {gen_req.month}/{gen_req.year}",
        )
        db.add(new_payroll)
        db.flush()

        # Notifications-ready
        if emp.user_id:
            notify_user(
                db,
                user_id=emp.user_id,
                title="New Payroll Generated",
                message=f"Your payslip for {gen_req.month}/{gen_req.year} has been generated. Net Salary: ${net_salary:,.2f}",
                notif_type=NotificationType.PAYROLL,
                link="/payroll",
            )

        created_payrolls.append(new_payroll)

    # Organization alert for HR/Admin
    notify_admins_and_hr(
        db,
        title="Payroll Run Completed",
        message=f"Payroll batch for {gen_req.month}/{gen_req.year} was generated ({len(created_payrolls)} payslips) by {current_user.email}.",
        notif_type=NotificationType.PAYROLL,
        link="/payroll",
    )

    db.commit()
    for p in created_payrolls:
        db.refresh(p)

    return [_to_payroll_response(p) for p in created_payrolls]


@router.get("/my-history", response_model=List[PayrollResponse])
def get_my_payroll_history(
    employee: Employee = Depends(get_current_employee),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Returns payroll records and payslip history for current authenticated employee."""
    query = db.query(Payroll).filter(Payroll.employee_id == employee.id)
    if year:
        query = query.filter(Payroll.year == year)

    records = query.order_by(Payroll.year.desc(), Payroll.month.desc()).all()
    return [_to_payroll_response(r) for r in records]


@router.get("/summary", response_model=PayrollSummary)
def get_payroll_summary(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns aggregated summary metrics for payroll."""
    query = db.query(Payroll)
    if month:
        query = query.filter(Payroll.month == month)
    if year:
        query = query.filter(Payroll.year == year)

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee record not found")
        query = query.filter(Payroll.employee_id == emp.id)

    records = query.all()
    total_count = len(records)
    total_net_payout = sum((r.net_salary for r in records), Decimal("0.00"))
    paid_count = sum(1 for r in records if r.payment_status == PaymentStatus.PAID)
    pending_count = sum(1 for r in records if r.payment_status == PaymentStatus.PENDING)
    processed_count = sum(1 for r in records if r.payment_status == PaymentStatus.PROCESSED)
    total_paid_amount = sum(
        (r.net_salary for r in records if r.payment_status == PaymentStatus.PAID),
        Decimal("0.00"),
    )
    total_pending_amount = sum(
        (r.net_salary for r in records if r.payment_status != PaymentStatus.PAID),
        Decimal("0.00"),
    )

    return PayrollSummary(
        total_payrolls=total_count,
        total_net_payout=round(total_net_payout, 2),
        paid_count=paid_count,
        pending_count=pending_count,
        processed_count=processed_count,
        total_paid_amount=round(total_paid_amount, 2),
        total_pending_amount=round(total_pending_amount, 2),
    )


@router.get("", response_model=List[PayrollResponse])
def list_payrolls(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    status: Optional[PaymentStatus] = Query(None),
    employee_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    List all organization payroll records with filtering.
    Restricted to ADMIN and HR.
    """
    query = db.query(Payroll)
    if month:
        query = query.filter(Payroll.month == month)
    if year:
        query = query.filter(Payroll.year == year)
    if status:
        query = query.filter(Payroll.payment_status == status)
    if employee_id:
        query = query.filter(Payroll.employee_id == employee_id)

    records = (
        query.order_by(Payroll.year.desc(), Payroll.month.desc(), Payroll.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_to_payroll_response(r) for r in records]


@router.get("/{payroll_id}", response_model=PayrollResponse)
def get_payroll_details(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """View single payroll / payslip details."""
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payroll record #{payroll_id} not found",
        )

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or p.employee_id != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to another employee's payslip",
            )

    return _to_payroll_response(p)


@router.put("/{payroll_id}", response_model=PayrollResponse)
def update_payroll_details(
    payroll_id: int,
    upd: PayrollUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Update payroll components (bonuses, allowances, deductions) and recalculate net salary.
    Restricted to ADMIN and HR.
    """
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payroll record #{payroll_id} not found",
        )

    if upd.bonuses is not None:
        p.bonuses = upd.bonuses
    if upd.allowances is not None:
        p.allowances = upd.allowances
    if upd.deductions is not None:
        p.deductions = upd.deductions
    if upd.tax_deduction is not None:
        p.tax_deduction = upd.tax_deduction
    if upd.payment_status is not None:
        p.payment_status = upd.payment_status
    if upd.payment_date is not None:
        p.payment_date = upd.payment_date
    if upd.payment_method is not None:
        p.payment_method = upd.payment_method
    if upd.notes is not None:
        p.notes = upd.notes

    # Recalculate net salary
    gross = p.base_salary + p.allowances + p.bonuses
    total_deduct = p.deductions + p.tax_deduction
    p.net_salary = round(gross - total_deduct, 2)

    db.commit()
    db.refresh(p)
    return _to_payroll_response(p)


@router.put("/{payroll_id}/pay", response_model=PayrollResponse)
def mark_payroll_paid(
    payroll_id: int,
    payment_method: PaymentMethod = Query(PaymentMethod.BANK_TRANSFER),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Mark payroll status as PAID with today's date.
    Dispatches notification to employee.
    Restricted to ADMIN and HR.
    """
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payroll record #{payroll_id} not found",
        )

    p.payment_status = PaymentStatus.PAID
    p.payment_date = date.today()
    p.payment_method = payment_method

    if p.employee and p.employee.user_id:
        notify_user(
            db,
            user_id=p.employee.user_id,
            title="Salary Disbursed",
            message=f"Your salary of ${p.net_salary:,.2f} for {p.month}/{p.year} has been marked as PAID via {payment_method.value}.",
            notif_type=NotificationType.PAYROLL,
            link="/payroll",
        )

    db.commit()
    db.refresh(p)
    return _to_payroll_response(p)

