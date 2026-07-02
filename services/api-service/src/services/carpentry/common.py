from __future__ import annotations

from dataclasses import dataclass
import re
from datetime import date, datetime
from typing import Any

from sqlalchemy.exc import DBAPIError, ResourceClosedError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.logging_config import get_logger

logger = get_logger(__name__)

_SCHEMA_IDENTIFIER_REGEX = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_INT_REGEX = re.compile(r"^-?\d+$")
_FLOAT_REGEX = re.compile(r"^[+-]?\d+[\.,]\d+$")
_ISO_DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}([Tt\s].*)?$")


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


def int_or_none(value: Any) -> int | None:
    if value in (None, ""):
        return None
    s = str(value).strip()
    if _INT_REGEX.match(s):
        try:
            return int(s)
        except Exception:
            return None
    # Accept floats with zero fractional part like '4.0' or '4,0'
    if _FLOAT_REGEX.match(s):
        try:
            f = float(s.replace(",", "."))
            if f.is_integer():
                return int(f)
        except Exception:
            return None
    return None


def date_or_none(value: Any) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    s = str(value).strip()
    if not s:
        return None
    # Try ISO date first (YYYY-MM-DD)
    try:
        return date.fromisoformat(s)
    except Exception:
        pass
    # Try full ISO datetime
    try:
        dt = datetime.fromisoformat(s)
        return dt.date()
    except Exception:
        return None


def _normalize_params_by_sql(sql: str, params: list[Any]) -> list[Any]:
    """Try to coerce string parameters to appropriate Python types based on SQL context.

    Handles common `INSERT INTO (col1,col2) VALUES ($1,$2)` and
    `UPDATE tbl SET col1 = $1, col2 = $2 WHERE ...` patterns by mapping
    column names to parameters. Falls back to converting boolean-like
    strings to actual booleans.
    """
    if not params:
        return params

    params_list = list(params)

    def _coerce(col: str | None, val: Any) -> Any:
        if val is None:
            return None
        if isinstance(val, str):
            s = val.strip()
            if s == "":
                return None
            sl = s.lower()
            if sl in ("true", "false"):
                return to_bool(s)

            col_l = (col or "").lower()
            # Columns that likely represent dates
            if "fecha" in col_l or col_l.endswith("_date") or col_l in ("fecha", "created_at"):
                maybe_date = date_or_none(s)
                return maybe_date if maybe_date is not None else val
            # Common integer id columns
            if col_l.endswith("_id") or col_l in (
                "id",
                "proceso_id",
                "area_id",
                "proyecto_id",
                "lote_id",
                "maquina_id",
                "persona_id",
                "material_id",
                "item_id",
                "responsable_id",
            ):
                maybe = int_or_none(s)
                return maybe if maybe is not None else val

            # Columns that likely represent decimal values
            if (
                "hora" in col_l
                or "capacidad" in col_l
                or "pct" in col_l
                or col_l in ("horas_dia_disponibles", "capacidad_semanal_horas")
            ):
                maybef = decimal_or_none(s)
                return maybef if maybef is not None else val

        return val

    # Try INSERT ... (cols) VALUES (...) pattern
    m = re.search(
        r"INSERT\s+INTO\s+[A-Za-z0-9_\.\"]+\s*\((?P<cols>[^)]+)\)\s*VALUES\s*\((?P<vals>[^)]+)\)",
        sql,
        re.IGNORECASE,
    )
    if m:
        cols = [c.strip().strip('"') for c in m.group("cols").split(",")]
        for i, col in enumerate(cols):
            if i < len(params_list):
                params_list[i] = _coerce(col, params_list[i])
        return params_list

    # Try UPDATE ... SET col = $1, col2 = $2 ... WHERE pattern
    m = re.search(r"UPDATE\s+[A-Za-z0-9_\.\"]+\s+SET\s+(?P<set>.+?)\s+WHERE", sql, re.IGNORECASE | re.DOTALL)
    if m:
        set_clause = m.group("set")
        assignments = re.findall(r"([A-Za-z0-9_\"]+)\s*=\s*\$(\d+)", set_clause)
        for col, ph in assignments:
            col_clean = col.strip().strip('"')
            idx = int(ph) - 1
            if 0 <= idx < len(params_list):
                params_list[idx] = _coerce(col_clean, params_list[idx])
        return params_list

    # Fallback: convert boolean-like and numeric-like strings
    for i, v in enumerate(params_list):
        if isinstance(v, str):
            s = v.strip()
            sl = s.lower()
            if sl in ("true", "false"):
                params_list[i] = to_bool(s)
                continue
            # fallback date detection for ISO-like date strings
            if _ISO_DATE_REGEX.match(s):
                maybe_date = date_or_none(s)
                if maybe_date is not None:
                    params_list[i] = maybe_date
                    continue
            if _INT_REGEX.match(s):
                try:
                    params_list[i] = int(s)
                    continue
                except Exception:
                    pass
            if _FLOAT_REGEX.match(s):
                maybef = decimal_or_none(s)
                if maybef is not None:
                    params_list[i] = maybef
                    continue

    return params_list


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
        if code == "23502":
            return AppError(
                "Falta un dato obligatorio para guardar el registro.",
                400,
                "DB_NOT_NULL",
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
        params_list = _normalize_params_by_sql(sql, params_list)
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
        params_list = _normalize_params_by_sql(sql, params_list)
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
