from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime
from sqlalchemy.schema import CreateTable

from app.database import Base


class Chore(Base):
    __tablename__ = "chores"
    __table_args__ = {"schema": "chores"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    interval_days = Column(Integer, nullable=False, default=1)
    due_date = Column(Date, nullable=False)
    done = Column(Boolean, default=False)
    done_by = Column(String(255))
    last_done = Column(Date)
    owner_email = Column(String(255))
    is_private = Column(Boolean, default=False)
    archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Chore(id={self.id}, name='{self.name}', due_date={self.due_date})>"
