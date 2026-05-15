import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_SSLMODE = os.getenv("DB_SSLMODE", "require")
DB_SCHEMA = os.getenv("DB_SCHEMA", "data")

if not all([DB_HOST, DB_NAME, DB_USER, DB_PASSWORD]):
    raise RuntimeError(
        "Faltan variables de entorno de base de datos. Revise DB_HOST, DB_NAME, DB_USER y DB_PASSWORD."
    )

DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    f"?sslmode={DB_SSLMODE}"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    future=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT current_database(), current_schema(), current_user"))
        row = result.fetchone()

        return {
            "database": row[0],
            "schema": row[1],
            "user": row[2],
            "configured_schema": DB_SCHEMA,
        }
    