from datetime import datetime
from typing import List
from sqlalchemy import Column, String, Boolean, DateTime, JSON, Integer
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class NotificationPreferences(Base):
    __tablename__ = "notification_preferences"
    __table_args__ = {"schema": "notifications"}

    user_email = Column(String(255), primary_key=True)
    enabled = Column(Boolean, default=True)
    notify_times = Column(JSONB, default=["09:00", "18:00"])
    notify_overdue = Column(Boolean, default=True)
    notify_soon = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<NotificationPreferences(user_email={self.user_email}, enabled={self.enabled})>"


class ScheduledNotification(Base):
    __tablename__ = "scheduled_notifications"
    __table_args__ = {"schema": "notifications"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_email = Column(String(255))
    chore_id = Column(Integer)
    scheduled_for = Column(DateTime)
    sent_at = Column(DateTime, nullable=True)
    notification_type = Column(String(50))
    processed = Column(Boolean, default=False)

    def __repr__(self):
        return f"<ScheduledNotification(id={self.id}, user_email={self.user_email}, type={self.notification_type})>"
