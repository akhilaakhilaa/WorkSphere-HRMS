import enum
from sqlalchemy import Column, Date, DateTime, Enum as SQLEnum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class EmployeeStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ON_LEAVE = "ON_LEAVE"
    TERMINATED = "TERMINATED"


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
        index=True,
    )
    full_name = Column(String(255), nullable=False, index=True)
    designation = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False, index=True)
    joining_date = Column(Date, nullable=False)
    salary = Column(Numeric(12, 2), nullable=False)
    status = Column(
        SQLEnum(EmployeeStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=EmployeeStatus.ACTIVE,
        nullable=False,
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="employee")
    attendances = relationship(
        "Attendance", back_populates="employee", cascade="all, delete-orphan"
    )
    leaves = relationship(
        "Leave", back_populates="employee", cascade="all, delete-orphan"
    )
    payrolls = relationship(
        "Payroll", back_populates="employee", cascade="all, delete-orphan"
    )
    leave_balances = relationship(
        "LeaveBalance", back_populates="employee", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Employee id={self.id} full_name={self.full_name} department={self.department}>"

