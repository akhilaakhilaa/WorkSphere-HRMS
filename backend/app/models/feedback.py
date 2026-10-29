from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message = Column(Text, nullable=False)
    rating = Column(Integer, nullable=False)  # 1 to 5
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    employee = relationship("Employee", back_populates="feedbacks")

    def __repr__(self):
        return f"<Feedback id={self.id} employee_id={self.employee_id} rating={self.rating}>"

