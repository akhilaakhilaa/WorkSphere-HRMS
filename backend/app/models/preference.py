from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import relationship

from app.database import Base


class UserNotificationPreference(Base):
    __tablename__ = "user_notification_preferences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    in_app_enabled = Column(Boolean, default=True, nullable=False)
    email_enabled = Column(Boolean, default=True, nullable=False)
    notify_leaves = Column(Boolean, default=True, nullable=False)
    notify_attendance = Column(Boolean, default=True, nullable=False)
    notify_tasks = Column(Boolean, default=True, nullable=False)
    notify_announcements = Column(Boolean, default=True, nullable=False)
    notify_payroll = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="notification_preferences")

    def __repr__(self):
        return (
            f"<UserNotificationPreference user_id={self.user_id} "
            f"in_app={self.in_app_enabled} email={self.email_enabled}>"
        )

