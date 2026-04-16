import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgres://choretwo:choretwo_dev@postgres:5432/choretwo?schema=ai"
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
            CREATE TABLE IF NOT EXISTS ai.ai_user_preferences (
                user_email VARCHAR(255) PRIMARY KEY,
                learning_enabled BOOLEAN DEFAULT TRUE,
                suggestion_types JSONB DEFAULT '["recurrence", "timing", "assignment"]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS ai.command_history (
                id SERIAL PRIMARY KEY,
                user_email VARCHAR(255),
                original_message TEXT,
                parsed_intent VARCHAR(50),
                executed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_command_history_user ON ai.command_history(user_email)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_command_history_intent ON ai.command_history(parsed_intent)"
            )
        )
        conn.commit()
    print("Database migrations completed")
