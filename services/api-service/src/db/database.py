import pyodbc
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from src.core.config import settings
from src.core.logging_config import get_logger

logger = get_logger(__name__)

if not settings.POSTGRES_URL_DATABASE:
    raise RuntimeError("POSTGRES_URL_DATABASE no esta definido en variables de entorno")

engine = create_async_engine(
    settings.POSTGRES_URL_DATABASE,
    echo=False,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT_SECONDS,
    pool_recycle=settings.DB_POOL_RECYCLE_SECONDS,
    pool_reset_on_return="rollback",
    connect_args={
        "timeout": settings.DB_CONNECT_TIMEOUT_SECONDS,
        "command_timeout": settings.DB_COMMAND_TIMEOUT_SECONDS,
        "server_settings": {
            "application_name": "allstar-api",
            "statement_timeout": str(settings.DB_STATEMENT_TIMEOUT_MS),
            "idle_in_transaction_session_timeout": str(
                settings.DB_IDLE_TRANSACTION_TIMEOUT_MS
            ),
            "lock_timeout": str(settings.DB_LOCK_TIMEOUT_MS),
        },
    },
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()


async def get_db():
    session = SessionLocal()
    try:
        yield session
    except Exception:
        await _rollback_safely(session)
        raise
    finally:
        await _rollback_safely(session)
        await session.close()


async def _rollback_safely(session: AsyncSession) -> None:
    try:
        if session.in_transaction():
            await session.rollback()
    except Exception as error:
        logger.warning("Error rolling back DB session: %s", error)


async def check_database() -> None:
    try:
        async with SessionLocal() as session:
            await session.execute(
                text(
                    "SET LOCAL statement_timeout = "
                    f"{min(int(settings.DB_STATEMENT_TIMEOUT_MS), 5000)}"
                )
            )
            await session.execute(text("SELECT 1"))
            await session.rollback()
    except SQLAlchemyError:
        logger.exception("PostgreSQL healthcheck failed")
        raise


async def get_sqlserver_db():
    if not settings.SQLSERVER_URL_DATABASE:
        logger.warning("SQLSERVER_URL_DATABASE no esta definido; integracion SQL Server deshabilitada")
        yield None
        return

    conn = None
    try:
        conn = await run_in_threadpool(pyodbc.connect, settings.SQLSERVER_URL_DATABASE)
    except Exception as e:
        logger.exception(f"Error conectando a SQL Server: {e}")
        # Degrade gracefully: yield None so endpoints can continue without SQL Server.
        yield None
        return

    try:
        yield conn
    finally:
        if conn is not None:
            try:
                await run_in_threadpool(conn.close)
            except Exception:
                pass
