from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    description = Column(Text, nullable=True)
    grace_period_minutes = Column(Integer, default=15, nullable=False)
    is_overnight = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    employee_shifts = relationship(
        "EmployeeShift", back_populates="shift", cascade="all, delete-orphan"
    )
    attendances = relationship("Attendance", back_populates="shift")

    def __repr__(self):
        return f"<Shift id={self.id} name='{self.name}' {self.start_time}-{self.end_time}>"


class EmployeeShift(Base):
    __tablename__ = "employee_shifts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shift_id = Column(
        Integer,
        ForeignKey("shifts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    employee = relationship("Employee", back_populates="employee_shifts")
    shift = relationship("Shift", back_populates="employee_shifts")

    def __repr__(self):
        return f"<EmployeeShift id={self.id} emp={self.employee_id} shift={self.shift_id} active={self.is_active}>"

