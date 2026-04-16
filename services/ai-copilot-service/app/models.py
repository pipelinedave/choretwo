from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, String, Boolean, DateTime, JSON, Integer
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class UserPreferences(Base):
    __tablename__ = "ai_user_preferences"
    __table_args__ = {"schema": "ai"}

    user_email = Column(String(255), primary_key=True)
    learning_enabled = Column(Boolean, default=True)
    suggestion_types = Column(JSONB, default=["recurrence", "timing", "assignment"])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<UserPreferences(user_email={self.user_email}, learning_enabled={self.learning_enabled})>"


class CommandHistory(Base):
    __tablename__ = "command_history"
    __table_args__ = {"schema": "ai"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_email = Column(String(255))
    original_message = Column(Text)
    parsed_intent = Column(String(50))
    executed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<CommandHistory(id={self.id}, user_email={self.user_email}, intent={self.parsed_intent})>"
