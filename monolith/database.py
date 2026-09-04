"""Gemeinsame Datenbank-Engine für den Choretwo-Monolith.

Alle vier Service-Pakete der Einzelservices arbeiten mit derselben
PostgreSQL-Instanz und mit Schema-qualifizierten Tabellennamen
(chores.*, logs.*, notifications.*). Dadurch kann der Monolith mit EINER
Engine/Session auskommen — das ist der Shared-Database-Singleton.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://choretwo:choretwo_dev@localhost:5432/choretwo?sslmode=disable",
)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, echo=False, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
