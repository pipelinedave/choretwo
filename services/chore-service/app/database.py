import os
from contextlib import asynccontextmanager
from datetime import datetime

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgres://choretwo:choretwo_dev@postgres:5432/choretwo?schema=chores",
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


@asynccontextmanager
async def get_db_connection():
    conn = engine.connect()
    try:
        yield conn
    finally:
        await conn.close()


def init_db():
    Base.metadata.create_all(bind=engine)


def run_migrations():
    with engine.connect() as conn:
        conn.execute(
            text("""
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
        """)
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_chores_owner ON chores.chores(owner_email)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_chores_archived ON chores.chores(archived)"
            )
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS idx_chores_done ON chores.chores(done)")
        )
        conn.commit()
    print("Database migrations completed")
