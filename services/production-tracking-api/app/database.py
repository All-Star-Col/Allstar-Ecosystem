from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker


BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)


DB_HOST = os.getenv("DB_HOST", "")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "")
DB_USER = os.getenv("DB_USER", "")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_SSLMODE = os.getenv("DB_SSLMODE", "require")
DB_SCHEMA = os.getenv("DB_SCHEMA", "carpentry")


if not DB_HOST:
    raise RuntimeError(f"Falta DB_HOST en el archivo .env. Ruta buscada: {ENV_PATH}")

if not DB_NAME:
    raise RuntimeError(f"Falta DB_NAME en el archivo .env. Ruta buscada: {ENV_PATH}")

if not DB_USER:
    raise RuntimeError(f"Falta DB_USER en el archivo .env. Ruta buscada: {ENV_PATH}")

if not DB_PASSWORD:
    raise RuntimeError(f"Falta DB_PASSWORD en el archivo .env. Ruta buscada: {ENV_PATH}")


DATABASE_URL = (
    f"postgresql+psycopg2://{quote_plus(DB_USER)}:"
    f"{quote_plus(DB_PASSWORD)}@{DB_HOST}:"
    f"{DB_PORT}/{DB_NAME}"
    f"?sslmode={quote_plus(DB_SSLMODE)}"
)


engine: Engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    future=True,
)


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True,
)


@contextmanager
def get_db():
    db = SessionLocal()

    try:
        db.execute(text(f"SET search_path TO {DB_SCHEMA}, public"))
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def test_connection() -> dict:
    with get_db() as db:
        result = db.execute(
            text(
                """
                SELECT
                    NOW() AS now,
                    CURRENT_DATABASE() AS database_name,
                    CURRENT_SCHEMA() AS current_schema
                """
            )
        ).mappings().first()

        tables = db.execute(
            text(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = :schema
                ORDER BY table_name
                """
            ),
            {"schema": DB_SCHEMA},
        ).mappings().all()

        return {
            "ok": True,
            "mensaje": "Conexión a PostgreSQL activa.",
            "host": DB_HOST,
            "database": result["database_name"] if result else DB_NAME,
            "schema": DB_SCHEMA,
            "current_schema": result["current_schema"] if result else None,
            "now": str(result["now"]) if result else None,
            "tablas_detectadas": [row["table_name"] for row in tables],
        }