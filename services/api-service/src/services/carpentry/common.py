from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any

from sqlalchemy.exc import DBAPIError, ResourceClosedError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.logging_config import get_logger

logger = get_logger(__name__)

_SCHEMA_IDENTIFIER_REGEX = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


@dataclass
class AppError(Exception):
    message: str
    status: int = 400
    code: str = "APP_ERROR"

    def __str__(self) -> str:
        return self.message


def clean(value: Any) -> Any:
    if value == "":
        return None
    return value


def decimal_or_none(value: Any) -> float | None:
    if value in (None, ""):
        return None
    parsed = str(value).replace(",", ".").strip()
    try:
        return float(parsed)
    except ValueError:
        return None


def to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() == "true"
    return bool(value)


def build_where(filters: dict[str, Any], mapping: dict[str, str], start_index: int = 1) -> tuple[str, list[Any], int]:
    clauses: list[str] = []
    values: list[Any] = []
    index = start_index

    for key, value in (filters or {}).items():
        if value in (None, ""):
            continue
        column = mapping.get(key)
        if not column:
            continue
        clauses.append(f"{column} = ${index}")
        values.append(value)
        index += 1

    if not clauses:
        return "", values, index
    return f"WHERE {' AND '.join(clauses)}", values, index


def to_csv(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return ""

    headers = list(rows[0].keys())

    def _escape(value: Any) -> str:
        if value is None:
            return ""
        text = str(value)
        if any(ch in text for ch in [",", '"', "\n"]):
            escaped = text.replace('"', '""')
            return f'"{escaped}"'
        return text

    lines = [",".join(headers)]
    for row in rows:
        lines.append(",".join(_escape(row.get(col)) for col in headers))

    return "\n".join(lines)


def map_database_error(error: Exception) -> AppError:
    if isinstance(error, AppError):
        return error

    if isinstance(error, DBAPIError):
        code = getattr(error.orig, "sqlstate", None) or getattr(error.orig, "pgcode", None)

        if code == "23505":
            return AppError(
                "Ya existe un registro con esos datos (duplicado).",
                409,
                "DB_DUPLICATE",
            )
        if code == "23503":
            return AppError(
                "No se puede completar la operación por referencias relacionadas.",
                400,
                "DB_FK",
            )
        if code == "23514":
            return AppError(
                "Los datos no cumplen las reglas de validación de la base de datos.",
                400,
                "DB_CHECK",
            )
        if code == "22P02":
            return AppError("Formato de dato inválido.", 400, "DB_INVALID_TEXT_REPRESENTATION")
        if code and str(code).startswith("22"):
            return AppError("Formato o valor de dato inválido.", 400, "DB_INVALID_DATA")
        if code == "42P01":
            return AppError(
                "No se encontraron tablas/vistas en el esquema configurado.",
                500,
                "DB_RELATION_NOT_FOUND",
            )
        if code in {"08001", "57P01"}:
            return AppError("No fue posible conectar con PostgreSQL.", 500, "DB_CONNECTION")

    return AppError(
        "Ocurrió un error al ejecutar la operación en la base de datos.",
        500,
        "DB_ERROR",
    )


def _resolve_carpentry_schema() -> str:
    schema = (settings.CARPENTRY_DB_SCHEMA or "carpentry").strip()
    if not _SCHEMA_IDENTIFIER_REGEX.fullmatch(schema):
        raise AppError(
            "La configuración CARPENTRY_DB_SCHEMA es inválida.",
            500,
            "CONFIG_SCHEMA_INVALID",
        )
    return schema


async def _get_carpentry_connection(db: AsyncSession):
    conn = await db.connection()
    schema = _resolve_carpentry_schema()
    # Apply search_path per-transaction to avoid leaking connection state in pool.
    await conn.exec_driver_sql(
        "SELECT set_config('search_path', $1, true)",
        (f"{schema},public",),
    )
    return conn


async def fetch_all(db: AsyncSession, sql: str, params: list[Any] | tuple[Any, ...] | None = None) -> list[dict[str, Any]]:
    params_list = list(params or [])
    try:
        conn = await _get_carpentry_connection(db)
        result = await conn.exec_driver_sql(sql, tuple(params_list))
        rows = result.fetchall()
        return [dict(row._mapping) for row in rows]
    except Exception:
        logger.exception(
            "Error leyendo SQL de Carpinteria: %s | params=%s",
            " ".join(sql.split())[:240],
            params_list,
        )
        raise


async def fetch_one(db: AsyncSession, sql: str, params: list[Any] | tuple[Any, ...] | None = None) -> dict[str, Any] | None:
    rows = await fetch_all(db, sql, params)
    return rows[0] if rows else None


async def execute(db: AsyncSession, sql: str, params: list[Any] | tuple[Any, ...] | None = None) -> list[dict[str, Any]]:
    params_list = list(params or [])
    try:
        conn = await _get_carpentry_connection(db)
        result = await conn.exec_driver_sql(sql, tuple(params_list))
        try:
            rows = result.fetchall()
        except ResourceClosedError:
            return []
        return [dict(row._mapping) for row in rows]
    except Exception:
        logger.exception(
            "Error ejecutando SQL en Carpinteria: %s | params=%s",
            " ".join(sql.split())[:240],
            params_list,
        )
        raise
