from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.payroll import PaymentMethod, PaymentStatus


class PayrollBase(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    base_salary: Decimal = Field(..., ge=0)
    hra: Decimal = Field(default=Decimal("0.00"), ge=0)
    transport_allowance: Decimal = Field(default=Decimal("0.00"), ge=0)
    medical_allowance: Decimal = Field(default=Decimal("0.00"), ge=0)
    allowances: Decimal = Field(default=Decimal("0.00"), ge=0)
    bonuses: Decimal = Field(default=Decimal("0.00"), ge=0)
    provident_fund: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax_deduction: Decimal = Field(default=Decimal("0.00"), ge=0)
    deductions: Decimal = Field(default=Decimal("0.00"), ge=0)
    payment_method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    notes: Optional[str] = None


class PayrollCreate(PayrollBase):
    employee_id: int


class PayrollGenerateRequest(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    employee_id: Optional[int] = None  # None means generate for all active employees


class PayrollUpdate(BaseModel):
    hra: Optional[Decimal] = Field(None, ge=0)
    transport_allowance: Optional[Decimal] = Field(None, ge=0)
    medical_allowance: Optional[Decimal] = Field(None, ge=0)
    allowances: Optional[Decimal] = Field(None, ge=0)
    bonuses: Optional[Decimal] = Field(None, ge=0)
    provident_fund: Optional[Decimal] = Field(None, ge=0)
    tax_deduction: Optional[Decimal] = Field(None, ge=0)
    deductions: Optional[Decimal] = Field(None, ge=0)
    payment_status: Optional[PaymentStatus] = None
    payment_date: Optional[date] = None
    payment_method: Optional[PaymentMethod] = None
    notes: Optional[str] = None


class PayrollResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    month: int
    year: int
    base_salary: Decimal
    basic_salary: Optional[Decimal] = None
    hra: Decimal = Decimal("0.00")
    transport_allowance: Decimal = Decimal("0.00")
    medical_allowance: Decimal = Decimal("0.00")
    allowances: Decimal
    bonuses: Decimal
    gross_salary: Optional[Decimal] = None
    provident_fund: Decimal = Decimal("0.00")
    tax_deduction: Decimal
    deductions: Decimal
    total_deductions: Optional[Decimal] = None
    net_salary: Decimal
    payment_status: PaymentStatus
    payment_date: Optional[date] = None
    payment_method: PaymentMethod
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DetailedSalaryBreakdown(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    month: int
    year: int
    # Earnings breakdown
    basic_salary: Decimal
    hra: Decimal
    transport_allowance: Decimal
    medical_allowance: Decimal
    other_allowances: Decimal
    bonuses: Decimal
    gross_salary: Decimal
    # Deductions breakdown
    tax_deduction: Decimal
    provident_fund: Decimal
    other_deductions: Decimal
    total_deductions: Decimal
    # Net Pay
    net_salary: Decimal
    # Payment details
    payment_status: PaymentStatus
    payment_date: Optional[date] = None
    payment_method: PaymentMethod
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PayrollSummary(BaseModel):
    total_payrolls: int
    total_net_payout: Decimal
    paid_count: int
    pending_count: int
    processed_count: int
    total_paid_amount: Decimal
    total_pending_amount: Decimal
    month: Optional[int] = None
    year: Optional[int] = None
    total_basic_salary: Decimal = Decimal("0.00")
    total_allowances: Decimal = Decimal("0.00")
    total_gross_payroll: Decimal = Decimal("0.00")
    total_deductions: Decimal = Decimal("0.00")
    total_net_payroll: Decimal = Decimal("0.00")
    payroll_status: str = "PENDING"


class MonthlyPayrollSummaryResponse(BaseModel):
    month: int
    year: int
    total_employees: int
    total_basic_salary: Decimal
    total_allowances: Decimal
    total_gross_payroll: Decimal
    total_deductions: Decimal
    total_net_payroll: Decimal
    paid_count: int
    pending_count: int
    processed_count: int
    payroll_status: str  # PAID, PENDING, PARTIALLY_PAID, NO_RECORDS
