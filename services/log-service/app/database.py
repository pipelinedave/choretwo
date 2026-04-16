import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgres://choretwo:choretwo_dev@postgres:5432/choretwo?schema=logs",
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
            CREATE TABLE IF NOT EXISTS logs.chore_logs (
                id SERIAL PRIMARY KEY,
                chore_id INT,
                done_by VARCHAR(255),
                done_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                action_type VARCHAR(50) NOT NULL,
                action_details JSONB
            )
        """)
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_chore_logs_chore_id ON logs.chore_logs(chore_id)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_chore_logs_done_by ON logs.chore_logs(done_by)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_chore_logs_action_type ON logs.chore_logs(action_type)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_chore_logs_done_at ON logs.chore_logs(done_at)"
            )
        )
        conn.commit()
    print("Database migrations completed")
