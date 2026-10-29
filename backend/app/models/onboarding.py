import enum
from sqlalchemy import Column, Date, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class OnboardingTaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"


class OnboardingTask(Base):
    __tablename__ = "onboarding_tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_name = Column(String(255), nullable=False)
    status = Column(
        SQLEnum(OnboardingTaskStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=OnboardingTaskStatus.PENDING,
        nullable=False,
        index=True,
    )
    due_date = Column(Date, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationship to Employee
    employee = relationship("Employee", back_populates="onboarding_tasks")

    def __repr__(self):
        return f"<OnboardingTask id={self.id} employee_id={self.employee_id} task='{self.task_name}' status={self.status}>"

