import enum
from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSED = "PROCESSED"
    PAID = "PAID"


class PaymentMethod(str, enum.Enum):
    BANK_TRANSFER = "BANK_TRANSFER"
    DIRECT_DEPOSIT = "DIRECT_DEPOSIT"
    CHEQUE = "CHEQUE"
    CASH = "CASH"


class Payroll(Base):
    __tablename__ = "payrolls"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    base_salary = Column(Numeric(12, 2), nullable=False)
    hra = Column(Numeric(12, 2), default=0.00, nullable=False)
    transport_allowance = Column(Numeric(12, 2), default=0.00, nullable=False)
    medical_allowance = Column(Numeric(12, 2), default=0.00, nullable=False)
    allowances = Column(Numeric(12, 2), default=0.00, nullable=False)
    bonuses = Column(Numeric(12, 2), default=0.00, nullable=False)
    gross_salary = Column(Numeric(12, 2), default=0.00, nullable=False)
    provident_fund = Column(Numeric(12, 2), default=0.00, nullable=False)
    tax_deduction = Column(Numeric(12, 2), default=0.00, nullable=False)
    deductions = Column(Numeric(12, 2), default=0.00, nullable=False)
    net_salary = Column(Numeric(12, 2), nullable=False)
    payment_status = Column(
        SQLEnum(PaymentStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=PaymentStatus.PENDING,
        nullable=False,
        index=True,
    )
    payment_date = Column(Date, nullable=True)
    payment_method = Column(
        SQLEnum(PaymentMethod, values_callable=lambda obj: [e.value for e in obj]),
        default=PaymentMethod.BANK_TRANSFER,
        nullable=False,
    )
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "employee_id", "month", "year", name="uq_employee_payroll_period"
        ),
    )

    # Relationships
    employee = relationship("Employee", back_populates="payrolls")

    def __repr__(self):
        return f"<Payroll id={self.id} employee_id={self.employee_id} {self.month}/{self.year} net={self.net_salary} status={self.payment_status}>"

