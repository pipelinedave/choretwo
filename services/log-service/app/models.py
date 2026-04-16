import json
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class ChoreLog(Base):
    __tablename__ = "chore_logs"
    __table_args__ = {"schema": "logs"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    chore_id = Column(Integer, nullable=True)
    done_by = Column(String(255), nullable=True)
    done_at = Column(DateTime, default=datetime.utcnow)
    action_type = Column(String(50), nullable=False)
    action_details = Column(JSONB, nullable=True)

    def __repr__(self):
        return f"<ChoreLog(id={self.id}, chore_id={self.chore_id}, action_type={self.action_type})>"
