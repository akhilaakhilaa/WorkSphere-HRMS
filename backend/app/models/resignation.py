import enum
from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class ResignationStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Resignation(Base):
    __tablename__ = "resignations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason = Column(Text, nullable=False)
    notice_period = Column(Integer, nullable=False)  # Notice period in days (e.g. 30, 60, 90)
    status = Column(
        SQLEnum(ResignationStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=ResignationStatus.PENDING,
        nullable=False,
        index=True,
    )
    last_working_day = Column(Date, nullable=True)
    reviewed_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_comments = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    employee = relationship("Employee", back_populates="resignations")
    reviewer = relationship("User", foreign_keys=[reviewed_by])

    def __repr__(self):
        return (
            f"<Resignation id={self.id} employee_id={self.employee_id} "
            f"notice_period={self.notice_period} status={self.status}>"
        )

