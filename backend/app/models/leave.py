import enum
from sqlalchemy import (
    CheckConstraint,
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


class LeaveType(str, enum.Enum):
    SICK = "SICK"
    CASUAL = "CASUAL"
    ANNUAL = "ANNUAL"
    MATERNITY = "MATERNITY"
    PATERNITY = "PATERNITY"
    UNPAID = "UNPAID"


class LeaveStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class Leave(Base):
    __tablename__ = "leaves"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    leave_type = Column(
        SQLEnum(LeaveType, values_callable=lambda obj: [e.value for e in obj]),
        default=LeaveType.CASUAL,
        nullable=False,
    )
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False)
    total_days = Column(Integer, nullable=False, default=1)
    reason = Column(Text, nullable=False)
    status = Column(
        SQLEnum(LeaveStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=LeaveStatus.PENDING,
        nullable=False,
        index=True,
    )
    admin_remarks = Column(Text, nullable=True)
    reviewed_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    employee = relationship("Employee", back_populates="leaves")
    reviewer = relationship("User", foreign_keys=[reviewed_by])

    def __repr__(self):
        return f"<Leave id={self.id} employee_id={self.employee_id} type={self.leave_type} status={self.status}>"


class LeavePolicy(Base):
    __tablename__ = "leave_policies"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    leave_type = Column(
        SQLEnum(LeaveType, values_callable=lambda obj: [e.value for e in obj]),
        unique=True,
        nullable=False,
        index=True,
    )
    total_days_allowed = Column(Numeric(5, 2), nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("total_days_allowed >= 0", name="chk_leave_policy_days_non_negative"),
    )

    def __repr__(self):
        return f"<LeavePolicy id={self.id} leave_type={self.leave_type} total_days={self.total_days_allowed}>"


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    leave_type = Column(
        SQLEnum(LeaveType, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    remaining_days = Column(Numeric(5, 2), nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    employee = relationship("Employee", back_populates="leave_balances")

    __table_args__ = (
        UniqueConstraint("employee_id", "leave_type", name="uq_employee_leave_type_balance"),
        CheckConstraint("remaining_days >= 0", name="chk_leave_balance_days_non_negative"),
    )

    def __repr__(self):
        return f"<LeaveBalance id={self.id} employee_id={self.employee_id} leave_type={self.leave_type} remaining={self.remaining_days}>"


