"""Shared database engine for all services in the monolith.

Each service still has its own database.py for standalone operation.
In monolith mode, this module is the single source of truth.
All service modules import get_db from here instead of their own database.py.
"""
import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://choretwo:choretwo_dev@localhost:5432/choretwo?sslmode=disable",
)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Single engine shared across all service modules
engine = create_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_all_migrations():
    """Run migrations from all included services in the correct order."""
    with engine.connect() as conn:
        # Ensure schemas exist before creating tables
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS chores"))
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS logs"))
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS notifications"))
        conn.commit()

    # Run each service's migration
    _migrate_chore_service()
    _migrate_log_service()
    _migrate_notification_service()
    print("[monolith] All database migrations completed")


def _migrate_chore_service():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS chores.chores (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                interval_days INT NOT NULL DEFAULT 1,
                due_date DATE NOT NULL,
                done BOOLEAN DEFAULT FALSE,
                done_by VARCHAR(255),
                last_done DATE,
                owner_email VARCHAR(255),
                is_private BOOLEAN DEFAULT FALSE,
                archived BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chores_owner ON chores.chores(owner_email)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chores_archived ON chores.chores(archived)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chores_done ON chores.chores(done)"))
        conn.commit()


def _migrate_log_service():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS logs.chore_logs (
                id SERIAL PRIMARY KEY,
                chore_id INT,
                done_by VARCHAR(255),
                done_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                action_type VARCHAR(50) NOT NULL,
                action_details JSONB
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chore_logs_chore_id ON logs.chore_logs(chore_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chore_logs_done_by ON logs.chore_logs(done_by)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chore_logs_action_type ON logs.chore_logs(action_type)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chore_logs_done_at ON logs.chore_logs(done_at)"))
        conn.commit()


def _migrate_notification_service():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications.notification_preferences (
                user_email VARCHAR(255) PRIMARY KEY,
                enabled BOOLEAN DEFAULT TRUE,
                notify_times JSONB DEFAULT '["09:00", "18:00"]'::jsonb,
                notify_overdue BOOLEAN DEFAULT TRUE,
                notify_soon BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications.scheduled_notifications (
                id SERIAL PRIMARY KEY,
                user_email VARCHAR(255),
                chore_id INT,
                scheduled_for TIMESTAMP,
                sent_at TIMESTAMP,
                notification_type VARCHAR(50),
                processed BOOLEAN DEFAULT FALSE
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_scheduled_user ON notifications.scheduled_notifications(user_email)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_scheduled_scheduled_for ON notifications.scheduled_notifications(scheduled_for)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_scheduled_processed ON notifications.scheduled_notifications(processed)"))
        conn.commit()
