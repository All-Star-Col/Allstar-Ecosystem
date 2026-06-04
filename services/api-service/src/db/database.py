import os
import pyodbc
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import sessionmaker, declarative_base

from src.core.config import settings
from src.core.logging_config import get_logger

logger = get_logger(__name__)

if not settings.POSTGRES_URL_DATABASE:
    raise RuntimeError("POSTGRES_URL_DATABASE no está definido en variables de entorno")
if not settings.SQLSERVER_URL_DATABASE:
    raise RuntimeError(
        "SQLSERVER_URL_DATABASE no está definido en variables de entorno"
    )

engine = create_async_engine(settings.POSTGRES_URL_DATABASE, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()


async def get_db():
    async with SessionLocal() as session:
        yield session


async def get_sqlserver_db():
    conn = None
    try:
        conn = await run_in_threadpool(pyodbc.connect, settings.SQLSERVER_URL_DATABASE)
    except Exception as e:
        logger.exception(f"Error conectando a SQL Server: {e}")
        # Degrade gracefully: yield None so endpoints can continue without SQL Server
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
