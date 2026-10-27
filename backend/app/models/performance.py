from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reviewer_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    review_period = Column(String(50), nullable=False, index=True)
    rating = Column(Integer, nullable=False, index=True)
    feedback = Column(Text, nullable=False)
    goals = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("employee_id", "review_period", name="uq_employee_review_period"),
    )

    # Relationships
    employee = relationship("Employee", back_populates="performance_reviews")
    reviewer = relationship("User", foreign_keys=[reviewer_id])

    def __repr__(self):
        return (
            f"<PerformanceReview id={self.id} employee_id={self.employee_id} "
            f"period={self.review_period} rating={self.rating}>"
        )

