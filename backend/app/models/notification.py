import enum
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class NotificationType(str, enum.Enum):
    LEAVE = "LEAVE"
    PAYROLL = "PAYROLL"
    ATTENDANCE = "ATTENDANCE"
    SYSTEM = "SYSTEM"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(
        SQLEnum(NotificationType, values_callable=lambda obj: [e.value for e in obj]),
        default=NotificationType.SYSTEM,
        nullable=False,
    )
    is_read = Column(Boolean, default=False, nullable=False)
    link = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationship
    user = relationship("User", back_populates="notifications")

    def __repr__(self):
        return f"<Notification id={self.id} user_id={self.user_id} title={self.title} read={self.is_read}>"

