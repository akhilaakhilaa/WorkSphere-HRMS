import enum
from sqlalchemy import Boolean, Column, DateTime, Enum as SQLEnum, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class UserRole(str, enum.Enum):
    EMPLOYEE = "EMPLOYEE"
    HR = "HR"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(
        SQLEnum(UserRole, values_callable=lambda obj: [e.value for e in obj]),
        default=UserRole.EMPLOYEE,
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # 1-to-1 relationship with Employee
    employee = relationship(
        "Employee", back_populates="user", uselist=False, cascade="all, delete"
    )
    notifications = relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User id={self.id} email={self.email} role={self.role}>"

