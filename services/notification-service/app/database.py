import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgres://choretwo:choretwo_dev@postgres:5432/choretwo?schema=notifications",
)

engine = create_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    with engine.connect() as conn:
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS notifications.notification_preferences (
                user_email VARCHAR(255) PRIMARY KEY,
                enabled BOOLEAN DEFAULT TRUE,
                notify_times JSONB DEFAULT '["09:00", "18:00"]'::jsonb,
                notify_overdue BOOLEAN DEFAULT TRUE,
                notify_soon BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS notifications.scheduled_notifications (
                id SERIAL PRIMARY KEY,
                user_email VARCHAR(255),
                chore_id INT,
                scheduled_for TIMESTAMP,
                sent_at TIMESTAMP,
                notification_type VARCHAR(50),
                processed BOOLEAN DEFAULT FALSE
            )
        """)
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_scheduled_user ON notifications.scheduled_notifications(user_email)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_scheduled_scheduled_for ON notifications.scheduled_notifications(scheduled_for)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_scheduled_processed ON notifications.scheduled_notifications(processed)"
            )
        )
        conn.commit()
    print("Database migrations completed")
