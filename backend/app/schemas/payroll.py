from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.payroll import PaymentMethod, PaymentStatus


class PayrollBase(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    base_salary: Decimal = Field(..., ge=0)
    allowances: Decimal = Field(default=Decimal("0.00"), ge=0)
    bonuses: Decimal = Field(default=Decimal("0.00"), ge=0)
    deductions: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax_deduction: Decimal = Field(default=Decimal("0.00"), ge=0)
    payment_method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    notes: Optional[str] = None


class PayrollCreate(PayrollBase):
    employee_id: int


class PayrollGenerateRequest(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    employee_id: Optional[int] = None  # None means generate for all active employees


class PayrollUpdate(BaseModel):
    allowances: Optional[Decimal] = Field(None, ge=0)
    bonuses: Optional[Decimal] = Field(None, ge=0)
    deductions: Optional[Decimal] = Field(None, ge=0)
    tax_deduction: Optional[Decimal] = Field(None, ge=0)
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
    allowances: Decimal
    bonuses: Decimal
    deductions: Decimal
    tax_deduction: Decimal
    net_salary: Decimal
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

