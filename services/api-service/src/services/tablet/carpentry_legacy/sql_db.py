# app/sql_db.py

from __future__ import annotations

import os
from pathlib import Path
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from src.core.config import settings


# ============================================================
# CARGA ROBUSTA DEL .ENV
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"


def _read_env_file_manually(env_path: Path) -> dict[str, str]:
    """
    Lee el archivo .env manualmente sin depender completamente de python-dotenv.
    Soporta UTF-8, UTF-8 con BOM, cp1252 y latin1.
    """

    if not env_path.exists():
        return {}

    encodings = ["utf-8-sig", "utf-8", "cp1252", "latin1"]
    content = None

    for encoding in encodings:
        try:
            content = env_path.read_text(encoding=encoding)
            break
        except UnicodeDecodeError:
            continue

    if content is None:
        return {}

    data: dict[str, str] = {}

    for raw_line in content.splitlines():
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if len(value) >= 2:
            if (value.startswith('"') and value.endswith('"')) or (
                value.startswith("'") and value.endswith("'")
            ):
                value = value[1:-1]

        data[key] = value

    return data


_MANUAL_ENV: dict[str, str] = {}


# ============================================================
# CONFIGURACIÓN BASE DE DATOS
# ============================================================

SCHEMA = (
    os.getenv("DB_SCHEMA")
    or settings.CARPENTRY_DB_SCHEMA
    or "carpentry"
)

DATABASE_URL = (
    settings.POSTGRES_URL_DATABASE
    or os.getenv("DATABASE_URL")
    or os.getenv("SQLALCHEMY_DATABASE_URL")
    or os.getenv("POSTGRES_URL")
    or os.getenv("POSTGRESQL_URL")
    or os.getenv("DB_URL")
)


def _to_sync_database_url(url: str | None) -> str | None:
    if not url:
        return None

    normalized = str(url).strip()
    if normalized.startswith("postgresql+asyncpg://"):
        normalized = normalized.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    if normalized.startswith("postgresql://"):
        normalized = normalized.replace("postgresql://", "postgresql+psycopg2://", 1)
    if normalized.startswith("postgres://"):
        normalized = normalized.replace("postgres://", "postgresql+psycopg2://", 1)

    parts = urlsplit(normalized)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    if "ssl" in query and "sslmode" not in query:
        query["sslmode"] = query.pop("ssl")
    return urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(query),
            parts.fragment,
        )
    )


def _build_database_url_from_db_vars() -> str | None:
    """
    Construye DATABASE_URL cuando el .env trae variables separadas:
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSLMODE.
    """

    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_sslmode = os.getenv("DB_SSLMODE")

    required_values = {
        "DB_HOST": db_host,
        "DB_NAME": db_name,
        "DB_USER": db_user,
        "DB_PASSWORD": db_password,
    }

    missing = [
        key
        for key, value in required_values.items()
        if value is None or str(value).strip() == ""
    ]

    if missing:
        return None

    url = (
        f"postgresql+psycopg2://{quote_plus(str(db_user))}:{quote_plus(str(db_password))}"
        f"@{str(db_host)}:{str(db_port)}/{str(db_name)}"
    )

    if db_sslmode:
        url += f"?sslmode={quote_plus(str(db_sslmode))}"

    return url


if not DATABASE_URL:
    DATABASE_URL = _build_database_url_from_db_vars()

DATABASE_URL = _to_sync_database_url(DATABASE_URL)

if not DATABASE_URL:
    raise RuntimeError(
        "\nNo se pudo construir la conexión a PostgreSQL.\n"
        f"Se buscó el archivo .env en: {ENV_PATH}\n"
        f"El archivo existe: {ENV_PATH.exists()}\n"
        f"Variables encontradas en .env: {list(_MANUAL_ENV.keys())}\n\n"
        "Opciones válidas:\n"
        "1. DATABASE_URL=postgresql+psycopg2://usuario:clave@localhost:5432/nombre_base\n"
        "2. DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD y opcionalmente DB_SSLMODE.\n"
    )


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    echo=False,
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================
# HELPERS
# ============================================================

def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    return value


def _dict(row: Any) -> dict[str, Any]:
    if row is None:
        return {}

    data = dict(row)
    return {str(k): _jsonable(v) for k, v in data.items()}


def _list(rows: Any) -> list[dict[str, Any]]:
    return [_dict(row) for row in rows]


def _schema_table(table: str) -> str:
    return f'"{SCHEMA}"."{table}"'


def _qcol(column: str) -> str:
    return '"' + column.replace('"', '""') + '"'


def _all(
    db: Session,
    sql: str,
    params: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    rows = db.execute(text(sql), params or {}).mappings().all()
    return _list(rows)


def _first(
    db: Session,
    sql: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    row = db.execute(text(sql), params or {}).mappings().first()
    return _dict(row) if row else None


def _table_exists(db: Session, table_name: str) -> bool:
    row = db.execute(
        text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = :schema
              AND table_name = :table_name
            LIMIT 1
            """
        ),
        {
            "schema": SCHEMA,
            "table_name": table_name,
        },
    ).first()

    return row is not None


def _get_columns(db: Session, table_name: str) -> set[str]:
    rows = db.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = :schema
              AND table_name = :table_name
            """
        ),
        {
            "schema": SCHEMA,
            "table_name": table_name,
        },
    ).fetchall()

    return {str(row[0]) for row in rows}


def _pick_column(columns: set[str], candidates: list[str]) -> str | None:
    for candidate in candidates:
        if candidate in columns:
            return candidate

    return None


def _normalize(value: Any) -> str:
    if value is None:
        return ""

    return (
        str(value)
        .strip()
        .lower()
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ñ", "n")
    )


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return False

    if isinstance(value, (int, float, Decimal)):
        return value != 0

    return str(value).strip().lower() in {"true", "t", "1", "si", "sí", "yes"}


def _build_set_clause(
    columns: set[str],
    values: dict[str, Any],
    include_updated_at: bool = True,
) -> tuple[list[str], dict[str, Any]]:
    sets: list[str] = []
    params: dict[str, Any] = {}

    for col, value in values.items():
        if col in columns and value is not None:
            safe_param = col.replace(" ", "_").replace("-", "_")
            sets.append(f"{_qcol(col)} = :{safe_param}")
            params[safe_param] = value

    if include_updated_at and "updated_at" in columns:
        sets.append("updated_at = NOW()")

    return sets, params


# ============================================================
# HEALTH
# ============================================================

def get_health(db: Session) -> dict[str, Any]:
    try:
        row = db.execute(text("SELECT 1 AS ok")).mappings().first()

        return {
            "ok": True,
            "status": "healthy",
            "db_ok": bool(row and row["ok"] == 1),
            "schema": SCHEMA,
            "env_path": str(ENV_PATH),
            "env_exists": ENV_PATH.exists(),
            "database_url_loaded": bool(DATABASE_URL),
            "env_keys_found": list(_MANUAL_ENV.keys()),
        }

    except Exception as e:
        return {
            "ok": False,
            "status": "unhealthy",
            "error": str(e),
            "schema": SCHEMA,
            "env_path": str(ENV_PATH),
            "env_exists": ENV_PATH.exists(),
            "database_url_loaded": bool(DATABASE_URL),
            "env_keys_found": list(_MANUAL_ENV.keys()),
        }


# ============================================================
# PROCESOS / PROYECTOS / LOTES
# ============================================================

def _proceso_to_api(row: dict[str, Any]) -> dict[str, Any]:
    nombre = row.get("nombre")
    nombre_norm = _normalize(nombre)

    if nombre_norm in {"seccionado", "enchape", "mecanizado"}:
        seccion = "piso1"
    elif nombre_norm == "armado":
        seccion = "piso2"
    elif nombre_norm in {"despacho", "transporte"}:
        seccion = "despacho"
    elif nombre_norm in {"instalacion", "instalación"}:
        seccion = "instalacion"
    else:
        seccion = "otro"

    if nombre_norm in {"instalacion", "instalación", "armado"}:
        modo = "por_mueble"
    else:
        modo = "lote_completo"

    requiere_consumo = nombre_norm in {"seccionado", "enchape"}

    if nombre_norm == "seccionado":
        categoria_consumo = "tablero"
    elif nombre_norm == "enchape":
        categoria_consumo = "canto"
    else:
        categoria_consumo = None

    data = dict(row)
    data.update(
        {
            "seccion": seccion,
            "modo_asignacion": modo,
            "requiere_consumo": requiere_consumo,
            "categoria_consumo": categoria_consumo,
        }
    )

    return data


def get_procesos_seccion(db: Session, seccion: str) -> list[dict[str, Any]]:
    if not _table_exists(db, "procesos"):
        return []

    rows = _all(
        db,
        f"""
        SELECT *
        FROM {_schema_table("procesos")}
        ORDER BY COALESCE(orden_linea, id), id
        """,
    )

    seccion_norm = _normalize(seccion)

    return [
        _proceso_to_api(row)
        for row in rows
        if _normalize(_proceso_to_api(row).get("seccion")) == seccion_norm
    ]


def get_procesos(db: Session, piso: int | None = None) -> list[dict[str, Any]]:
    if not _table_exists(db, "procesos"):
        return []

    rows = _all(
        db,
        f"""
        SELECT *
        FROM {_schema_table("procesos")}
        ORDER BY COALESCE(orden_linea, id), id
        """,
    )

    procesos = [_proceso_to_api(row) for row in rows]

    if piso == 1:
        return [p for p in procesos if p.get("seccion") == "piso1"]

    if piso == 2:
        return [p for p in procesos if p.get("seccion") == "piso2"]

    return procesos


def get_proyectos(
    db: Session,
    proceso_id: int | None = None,
) -> list[dict[str, Any]]:
    if not _table_exists(db, "proyectos"):
        return []

    if proceso_id is None:
        return _all(
            db,
            f"""
            SELECT *
            FROM {_schema_table("proyectos")}
            ORDER BY id
            """,
        )

    return _all(
        db,
        f"""
        SELECT DISTINCT p.*
        FROM {_schema_table("proyectos")} p
        INNER JOIN {_schema_table("lotes")} l
            ON l.proyecto_id = p.id
        INNER JOIN {_schema_table("lote_procesos")} lp
            ON lp.lote_id = l.id
        WHERE lp.proceso_id = :proceso_id
        ORDER BY p.id
        """,
        {"proceso_id": proceso_id},
    )


def get_lotes(
    db: Session,
    proyecto_id: int,
    proceso_id: int | None = None,
) -> list[dict[str, Any]]:
    if not _table_exists(db, "lotes"):
        return []

    if proceso_id is None:
        return _all(
            db,
            f"""
            SELECT *
            FROM {_schema_table("lotes")}
            WHERE proyecto_id = :proyecto_id
            ORDER BY id
            """,
            {"proyecto_id": proyecto_id},
        )

    return _all(
        db,
        f"""
        SELECT
            l.*,
            l.id AS lote_id,
            lp.id AS lote_proceso_id,
            lp.proceso_id,
            lp.estado AS estado_proceso,
            lp.fecha_programada,
            lp.fecha_inicio_real,
            lp.fecha_fin_real,
            lp.responsable_id,
            lp.maquina_id,
            lp.motivo_bloqueo,
            lp.notas AS notas_proceso
        FROM {_schema_table("lotes")} l
        INNER JOIN {_schema_table("lote_procesos")} lp
            ON lp.lote_id = l.id
        WHERE l.proyecto_id = :proyecto_id
          AND lp.proceso_id = :proceso_id
        ORDER BY l.id
        """,
        {
            "proyecto_id": proyecto_id,
            "proceso_id": proceso_id,
        },
    )


def get_lote_proceso(
    db: Session,
    lote_proceso_id: int,
) -> dict[str, Any] | None:
    row = _first(
        db,
        f"""
        SELECT
            lp.*,
            lp.id AS lote_proceso_id,
            l.nombre AS lote_nombre,
            l.proyecto_id,
            p.nombre AS proceso_nombre,
            NULL::TEXT AS proceso_seccion,
            pr.nombre AS proyecto_nombre,
            pr.cliente AS cliente
        FROM {_schema_table("lote_procesos")} lp
        LEFT JOIN {_schema_table("lotes")} l
            ON l.id = lp.lote_id
        LEFT JOIN {_schema_table("procesos")} p
            ON p.id = lp.proceso_id
        LEFT JOIN {_schema_table("proyectos")} pr
            ON pr.id = l.proyecto_id
        WHERE lp.id = :lote_proceso_id
        LIMIT 1
        """,
        {"lote_proceso_id": lote_proceso_id},
    )

    if not row:
        return None

    proceso_api = _proceso_to_api({"nombre": row.get("proceso_nombre")})
    row["proceso_seccion"] = proceso_api.get("seccion")
    row["modo_asignacion"] = proceso_api.get("modo_asignacion")
    row["motivos_bloqueo"] = row.get("motivo_bloqueo")

    return row


def get_modo_proceso(
    db: Session,
    lote_proceso_id: int,
) -> dict[str, Any]:
    row = get_lote_proceso(db, lote_proceso_id)
    if not row:
        return {
            "ok": False,
            "mensaje": "No se encontro el proceso del lote.",
        }

    return {
        "ok": True,
        "lote_proceso_id": lote_proceso_id,
        "proceso_id": row.get("proceso_id"),
        "proceso_nombre": row.get("proceso_nombre"),
        "proceso_seccion": row.get("proceso_seccion"),
        "modo_asignacion": row.get("modo_asignacion") or "general",
    }


# ============================================================
# RESPONSABLES / MÁQUINAS
# ============================================================

def get_responsables(
    db: Session,
    proceso_id: int | None = None,
) -> list[dict[str, Any]]:
    if not _table_exists(db, "personas"):
        return []

    return _all(
        db,
        f"""
        SELECT *
        FROM {_schema_table("personas")}
        WHERE activo = TRUE
        ORDER BY nombre, id
        """,
    )


def get_maquinas(
    db: Session,
    proceso_id: int | None = None,
) -> list[dict[str, Any]]:
    if not _table_exists(db, "maquinas"):
        return []

    if proceso_id is not None:
        return _all(
            db,
            f"""
            SELECT *, horas_dia_disponibles AS horas_dia_disponible
            FROM {_schema_table("maquinas")}
            WHERE activo = TRUE
              AND proceso_id = :proceso_id
            ORDER BY nombre, id
            """,
            {"proceso_id": proceso_id},
        )

    return _all(
        db,
        f"""
        SELECT *, horas_dia_disponibles AS horas_dia_disponible
        FROM {_schema_table("maquinas")}
        WHERE activo = TRUE
        ORDER BY nombre, id
        """,
    )


# ============================================================
# TAREAS PROCESO
# ============================================================

def get_tareas_proceso(
    db: Session,
    lote_proceso_id: int,
) -> list[dict[str, Any]]:
    if not _table_exists(db, "tareas_proceso"):
        return []

    return _all(
        db,
        f"""
        SELECT
            tp.*,
            tp.id AS tarea_id,
            ip.apartamento AS item_apartamento,
            ip.piso AS item_piso,
            ip.nombre AS item_nombre,
            pe.nombre AS responsable_nombre,
            CASE
                WHEN ip.nombre IS NOT NULL THEN
                    CONCAT(
                        ip.nombre,
                        CASE WHEN ip.piso IS NOT NULL THEN CONCAT(' - Piso ', ip.piso) ELSE '' END,
                        CASE WHEN ip.apartamento IS NOT NULL THEN CONCAT(' - Apto ', ip.apartamento) ELSE '' END
                    )
                ELSE COALESCE(tp.grupo_pieza, 'Tarea general')
            END AS item_label
        FROM {_schema_table("tareas_proceso")} tp
        LEFT JOIN {_schema_table("items_proyecto")} ip
            ON ip.id = tp.item_id
        LEFT JOIN {_schema_table("personas")} pe
            ON pe.id = tp.responsable_id
        WHERE tp.lote_proceso_id = :lote_proceso_id
        ORDER BY
            ip.apartamento NULLS LAST,
            ip.nombre NULLS LAST,
            tp.id
        """,
        {"lote_proceso_id": lote_proceso_id},
    )


def generar_tareas_proceso(
    db: Session,
    lote_proceso_id: int,
    responsable_id: int | None = None,
    maquina_id: int | None = None,
    usuario: str | None = None,
) -> dict[str, Any]:
    lote_proceso = get_lote_proceso(db, lote_proceso_id)

    if not lote_proceso:
        return {
            "ok": False,
            "mensaje": "No existe el lote_proceso.",
            "creadas": 0,
            "tareas": [],
        }

    lote_id = lote_proceso.get("lote_id")
    proceso_id = lote_proceso.get("proceso_id")

    existentes = _first(
        db,
        f"""
        SELECT COUNT(*) AS total
        FROM {_schema_table("tareas_proceso")}
        WHERE lote_proceso_id = :lote_proceso_id
        """,
        {"lote_proceso_id": lote_proceso_id},
    )

    if existentes and int(existentes.get("total") or 0) > 0:
        return {
            "ok": True,
            "mensaje": "Las tareas ya estaban generadas.",
            "creadas": 0,
            "tareas": get_tareas_proceso(db, lote_proceso_id),
        }

    result = db.execute(
        text(
            f"""
            INSERT INTO {_schema_table("tareas_proceso")} (
                lote_proceso_id,
                lote_id,
                proceso_id,
                item_id,
                tipo_tarea,
                estado,
                responsable_id,
                maquina_id,
                created_at,
                updated_at
            )
            SELECT
                :lote_proceso_id,
                :lote_id,
                :proceso_id,
                ip.id,
                'mueble',
                'pendiente',
                :responsable_id,
                :maquina_id,
                NOW(),
                NOW()
            FROM {_schema_table("items_proyecto")} ip
            WHERE ip.lote_id = :lote_id
            ORDER BY ip.id
            """
        ),
        {
            "lote_proceso_id": lote_proceso_id,
            "lote_id": lote_id,
            "proceso_id": proceso_id,
            "responsable_id": responsable_id,
            "maquina_id": maquina_id,
        },
    )

    db.commit()

    return {
        "ok": True,
        "mensaje": "Tareas generadas correctamente.",
        "creadas": result.rowcount or 0,
        "tareas": get_tareas_proceso(db, lote_proceso_id),
    }


def actualizar_tarea_proceso(
    db: Session,
    tarea_id: int,
    estado: str | None = None,
    responsable_id: int | None = None,
    maquina_id: int | None = None,
    fecha_inicio_real: str | None = None,
    fecha_fin_real: str | None = None,
    cantidad_programada: float | None = None,
    cantidad_real: float | None = None,
    notas: str | None = None,
    notas_bloqueo: str | None = None,
) -> dict[str, Any]:
    columns = _get_columns(db, "tareas_proceso")

    sets = []
    params: dict[str, Any] = {
        "tarea_id": tarea_id,
        "estado": estado,
        "responsable_id": responsable_id,
        "maquina_id": maquina_id,
        "fecha_inicio_real": fecha_inicio_real,
        "fecha_fin_real": fecha_fin_real,
        "cantidad_programada": cantidad_programada,
        "cantidad_real": cantidad_real,
        "notas": notas,
        "notas_bloqueo": notas_bloqueo,
    }

    if estado is not None and "estado" in columns:
        sets.append("estado = :estado")

        if estado == "en_proceso" and "fecha_inicio_real" in columns:
            sets.append("fecha_inicio_real = COALESCE(fecha_inicio_real, NOW())")

        if estado == "completado" and "fecha_fin_real" in columns:
            sets.append("fecha_fin_real = COALESCE(fecha_fin_real, NOW())")

    optional_fields = [
        "responsable_id",
        "maquina_id",
        "fecha_inicio_real",
        "fecha_fin_real",
        "cantidad_programada",
        "cantidad_real",
        "notas",
        "notas_bloqueo",
    ]

    for field in optional_fields:
        if field in columns and params.get(field) is not None:
            sets.append(f"{_qcol(field)} = :{field}")

    if "updated_at" in columns:
        sets.append("updated_at = NOW()")

    if not sets:
        return {
            "ok": False,
            "mensaje": "No hay campos válidos para actualizar la tarea.",
        }

    row = db.execute(
        text(
            f"""
            UPDATE {_schema_table("tareas_proceso")}
            SET {", ".join(sets)}
            WHERE id = :tarea_id
            RETURNING *
            """
        ),
        params,
    ).mappings().first()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Tarea actualizada correctamente.",
        "tarea": _dict(row) if row else None,
    }


actualizar_tarea = actualizar_tarea_proceso


def asignar_responsable_mueble(
    db: Session,
    lote_proceso_id: int,
    item_id: int,
    responsable_id: int,
    maquina_id: int | None = None,
    notas: str | None = None,
) -> dict[str, Any]:
    tarea = _first(
        db,
        f"""
        SELECT id
        FROM {_schema_table("tareas_proceso")}
        WHERE lote_proceso_id = :lote_proceso_id
          AND item_id = :item_id
        LIMIT 1
        """,
        {
            "lote_proceso_id": lote_proceso_id,
            "item_id": item_id,
        },
    )

    if tarea:
        return actualizar_tarea_proceso(
            db=db,
            tarea_id=int(tarea["id"]),
            responsable_id=responsable_id,
            maquina_id=maquina_id,
            notas=notas,
        )

    lote_proceso = get_lote_proceso(db, lote_proceso_id)

    if not lote_proceso:
        return {"ok": False, "mensaje": "No existe el lote_proceso."}

    row = db.execute(
        text(
            f"""
            INSERT INTO {_schema_table("tareas_proceso")} (
                lote_proceso_id,
                lote_id,
                proceso_id,
                item_id,
                tipo_tarea,
                responsable_id,
                maquina_id,
                estado,
                notas,
                created_at,
                updated_at
            )
            VALUES (
                :lote_proceso_id,
                :lote_id,
                :proceso_id,
                :item_id,
                'mueble',
                :responsable_id,
                :maquina_id,
                'pendiente',
                :notas,
                NOW(),
                NOW()
            )
            RETURNING *
            """
        ),
        {
            "lote_proceso_id": lote_proceso_id,
            "lote_id": lote_proceso.get("lote_id"),
            "proceso_id": lote_proceso.get("proceso_id"),
            "item_id": item_id,
            "responsable_id": responsable_id,
            "maquina_id": maquina_id,
            "notas": notas,
        },
    ).mappings().first()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Responsable asignado correctamente.",
        "tarea": _dict(row) if row else None,
    }


# ============================================================
# MATERIALES / INVENTARIOS
# ============================================================

def _categorias_por_proceso(proceso_id: int) -> list[str]:
    proceso_id = int(proceso_id)

    if proceso_id == 1:
        return ["tablero", "tableros"]

    if proceso_id == 2:
        return ["canto", "cantos", "tapacanto", "tapacantos"]

    return []


def get_materiales_consumo_detalle(
    db: Session,
    lote_id: int,
    proceso_id: int,
) -> list[dict[str, Any]]:
    categorias = _categorias_por_proceso(proceso_id)

    if not categorias:
        return []

    if not _table_exists(db, "bom_items") or not _table_exists(db, "inventario"):
        return []

    return _all(
        db,
        f"""
        WITH consumo AS (
            SELECT
                bi.material_id,
                SUM(COALESCE(bi.cantidad_requerida, 0)) AS cantidad_programada
            FROM {_schema_table("bom_items")} bi
            INNER JOIN {_schema_table("items_proyecto")} ip
                ON ip.id = bi.item_id
            WHERE ip.lote_id = :lote_id
            GROUP BY bi.material_id
        ),
        inventario_agrupado AS (
            SELECT
                i.material_id,
                SUM(COALESCE(i.cantidad_disponible, 0)) AS cantidad_disponible
            FROM {_schema_table("inventario")} i
            GROUP BY i.material_id
        )
        SELECT
            c.material_id,
            COALESCE(mc.nombre, CONCAT('Material ', c.material_id)) AS material_nombre,
            COALESCE(mc.categoria, 'sin_categoria') AS categoria,
            COALESCE(mc.unidad_medida, '') AS unidad_medida,
            COALESCE(c.cantidad_programada, 0) AS cantidad_programada,
            COALESCE(inv.cantidad_disponible, 0) AS cantidad_disponible,
            GREATEST(
                COALESCE(c.cantidad_programada, 0) - COALESCE(inv.cantidad_disponible, 0),
                0
            ) AS cantidad_faltante,
            CASE
                WHEN mc.id IS NULL THEN FALSE
                ELSE TRUE
            END AS existe_catalogo,
            CASE
                WHEN mc.id IS NULL THEN 'Material no existe en catálogo.'
                WHEN COALESCE(inv.cantidad_disponible, 0) < COALESCE(c.cantidad_programada, 0)
                    THEN 'Inventario insuficiente.'
                ELSE NULL
            END AS advertencia_catalogo
        FROM consumo c
        LEFT JOIN {_schema_table("materiales_catalogo")} mc
            ON mc.id = c.material_id
        LEFT JOIN inventario_agrupado inv
            ON inv.material_id = c.material_id
        WHERE LOWER(COALESCE(mc.categoria, '')) = ANY(:categorias)
        ORDER BY COALESCE(mc.nombre, CONCAT('Material ', c.material_id))
        """,
        {
            "lote_id": lote_id,
            "categorias": categorias,
        },
    )


def get_materiales_consumo(
    db: Session,
    lote_id: int,
    proceso_id: int,
) -> list[dict[str, Any]]:
    return get_materiales_consumo_detalle(db, lote_id, proceso_id)


def get_materiales_catalogo(db: Session) -> list[dict[str, Any]]:
    if not _table_exists(db, "materiales_catalogo"):
        return []

    return _all(
        db,
        f"""
        SELECT *
        FROM {_schema_table("materiales_catalogo")}
        ORDER BY id
        """,
    )


def get_inventarios(db: Session) -> list[dict[str, Any]]:
    if not _table_exists(db, "inventario"):
        return []

    return _all(
        db,
        f"""
        SELECT
            i.*,
            mc.nombre AS material_nombre,
            mc.categoria AS material_categoria,
            mc.unidad_medida
        FROM {_schema_table("inventario")} i
        LEFT JOIN {_schema_table("materiales_catalogo")} mc
            ON mc.id = i.material_id
        ORDER BY i.id
        """,
    )


def get_inventario(db: Session, categoria: str | None = None) -> list[dict[str, Any]]:
    rows = get_inventarios(db)
    if not categoria:
        return rows

    target = _normalize(categoria)
    return [
        row
        for row in rows
        if _normalize(row.get("material_categoria") or row.get("categoria")) == target
    ]


def registrar_consumo_parcial(
    db: Session,
    lote_proceso_id: int,
    material_id: int,
    cantidad_real: float,
    notas: str | None = None,
) -> dict[str, Any]:
    if cantidad_real <= 0:
        return {"ok": False, "mensaje": "La cantidad real debe ser mayor a cero."}

    material = _first(
        db,
        f"""
        SELECT
            mc.id AS material_id,
            mc.nombre AS material_nombre,
            COALESCE(i.cantidad_disponible, 0) AS cantidad_disponible
        FROM {_schema_table("materiales_catalogo")} mc
        LEFT JOIN {_schema_table("inventario")} i
            ON i.material_id = mc.id
        WHERE mc.id = :material_id
        LIMIT 1
        """,
        {"material_id": material_id},
    )

    if not material:
        return {"ok": False, "mensaje": "El material no existe en catálogo."}

    cantidad_disponible = float(material.get("cantidad_disponible") or 0)

    if cantidad_real > cantidad_disponible:
        return {
            "ok": False,
            "mensaje": f"Inventario insuficiente. Disponible: {cantidad_disponible}.",
        }

    db.execute(
        text(
            f"""
            UPDATE {_schema_table("inventario")}
            SET
                cantidad_disponible = COALESCE(cantidad_disponible, 0) - :cantidad_real,
                ultima_actualizacion = NOW()
            WHERE material_id = :material_id
            """
        ),
        {
            "material_id": material_id,
            "cantidad_real": cantidad_real,
        },
    )

    db.commit()

    return {
        "ok": True,
        "mensaje": "Consumo registrado correctamente.",
        "material_id": material_id,
        "material_nombre": material.get("material_nombre"),
        "cantidad_agregada": cantidad_real,
        "cantidad_disponible": cantidad_disponible - cantidad_real,
    }


def get_consumos_acumulados(
    db: Session,
    lote_proceso_id: int,
) -> list[dict[str, Any]]:
    if not _table_exists(db, "movimientos_inventario"):
        return []
    if not _table_exists(db, "lote_procesos"):
        return []

    return _all(
        db,
        f"""
        SELECT
            mi.*,
            mc.nombre AS material_nombre,
            mc.categoria AS material_categoria,
            mc.unidad_medida
        FROM {_schema_table("movimientos_inventario")} mi
        JOIN {_schema_table("lote_procesos")} lp
            ON lp.lote_id = mi.lote_id
        LEFT JOIN {_schema_table("materiales_catalogo")} mc
            ON mc.id = mi.material_id
        WHERE lp.id = :lote_proceso_id
        ORDER BY mi.created_at DESC NULLS LAST, mi.id DESC
        """,
        {"lote_proceso_id": lote_proceso_id},
    )


def registrar_consumo_canto(
    db: Session,
    lote_proceso_id: int,
    material_id: int,
    ubicacion: str,
    cantidad_real: float,
    notas: str | None = None,
) -> dict[str, Any]:
    detalle_notas = f"Ubicacion: {ubicacion}."
    if notas:
        detalle_notas = f"{detalle_notas} {notas}"

    result = registrar_consumo_parcial(
        db,
        lote_proceso_id=lote_proceso_id,
        material_id=material_id,
        cantidad_real=cantidad_real,
        notas=detalle_notas,
    )
    if not result.get("ok"):
        return result

    if _table_exists(db, "movimientos_inventario") and _table_exists(db, "lote_procesos"):
        lote = _first(
            db,
            f"""
            SELECT lp.lote_id, l.proyecto_id
            FROM {_schema_table("lote_procesos")} lp
            LEFT JOIN {_schema_table("lotes")} l ON l.id = lp.lote_id
            WHERE lp.id = :lote_proceso_id
            LIMIT 1
            """,
            {"lote_proceso_id": lote_proceso_id},
        )
        db.execute(
            text(
                f"""
                INSERT INTO {_schema_table("movimientos_inventario")} (
                    material_id,
                    tipo,
                    cantidad,
                    lote_id,
                    proyecto_id,
                    referencia,
                    notas
                )
                VALUES (
                    :material_id,
                    'salida',
                    :cantidad,
                    :lote_id,
                    :proyecto_id,
                    :referencia,
                    :notas
                )
                """
            ),
            {
                "material_id": material_id,
                "cantidad": cantidad_real,
                "lote_id": (lote or {}).get("lote_id"),
                "proyecto_id": (lote or {}).get("proyecto_id"),
                "referencia": ubicacion,
                "notas": detalle_notas,
            },
        )
        db.commit()

    return {
        **result,
        "mensaje": "Consumo de canto registrado correctamente.",
        "ubicacion": ubicacion,
    }


def get_inventario_cantos(db: Session) -> list[dict[str, Any]]:
    if not _table_exists(db, "inventario"):
        return []

    return _all(
        db,
        f"""
        SELECT
            i.id AS inventario_id,
            i.material_id,
            mc.nombre AS material_nombre,
            mc.categoria,
            COALESCE(mc.unidad_medida, 'unidad') AS unidad_medida,
            COALESCE(i.cantidad_disponible, 0) AS cantidad_disponible,
            COALESCE(i.ubicacion, 'SIN UBICACION') AS ubicacion,
            i.ultima_actualizacion
        FROM {_schema_table("inventario")} i
        LEFT JOIN {_schema_table("materiales_catalogo")} mc
            ON mc.id = i.material_id
        WHERE COALESCE(i.cantidad_disponible, 0) > 0
          AND (
                LOWER(COALESCE(mc.categoria, '')) IN (
                    'canto',
                    'cantos',
                    'tapacanto',
                    'tapacantos'
                )
                OR LOWER(COALESCE(mc.nombre, '')) LIKE '%canto%'
                OR LOWER(COALESCE(mc.nombre, '')) LIKE '%tapacanto%'
                OR LOWER(COALESCE(mc.nombre, '')) LIKE '%rigido%'
                OR LOWER(COALESCE(mc.nombre, '')) LIKE '%rígido%'
                OR LOWER(COALESCE(mc.nombre, '')) LIKE '%semirigido%'
                OR LOWER(COALESCE(mc.nombre, '')) LIKE '%semi rigido%'
                OR LOWER(COALESCE(mc.nombre, '')) LIKE '%flexible%'
              )
        ORDER BY
            COALESCE(mc.nombre, CONCAT('Material ', i.material_id)),
            COALESCE(i.ubicacion, 'SIN UBICACION')
        """
    )

# ============================================================
# MUEBLES / PIEZAS / INSTALACIÓN
# ============================================================

def get_muebles_lote(
    db: Session,
    lote_id: int,
) -> list[dict[str, Any]]:
    if not _table_exists(db, "items_proyecto"):
        return []

    return _all(
        db,
        f"""
        SELECT
            ip.*,
            ip.id AS item_id,
            CONCAT(
                ip.nombre,
                CASE WHEN ip.piso IS NOT NULL THEN CONCAT(' - Piso ', ip.piso) ELSE '' END,
                CASE WHEN ip.apartamento IS NOT NULL THEN CONCAT(' - Apto ', ip.apartamento) ELSE '' END
            ) AS label
        FROM {_schema_table("items_proyecto")} ip
        WHERE ip.lote_id = :lote_id
        ORDER BY ip.apartamento NULLS LAST, ip.nombre NULLS LAST, ip.id
        """,
        {"lote_id": lote_id},
    )


def get_piezas(db: Session) -> list[dict[str, Any]]:
    if not _table_exists(db, "piezas"):
        return []

    return _all(
        db,
        f"""
        SELECT
            id,
            COALESCE(nombre, pieza, CONCAT('Pieza ', id)) AS pieza,
            activo,
            created_at,
            updated_at,
            nombre
        FROM {_schema_table("piezas")}
        WHERE COALESCE(activo, TRUE) = TRUE
        ORDER BY COALESCE(nombre, pieza), id
        """,
    )


def get_piezas_mueble(
    db: Session,
    lote_id: int,
    item_id: int | None = None,
) -> list[dict[str, Any]]:
    filters = ["pm.lote_id = :lote_id"]
    params: dict[str, Any] = {"lote_id": lote_id}

    if item_id is not None:
        filters.append("pm.items_proyecto_id = :item_id")
        params["item_id"] = item_id

    where_sql = " AND ".join(filters)

    return _all(
        db,
        f"""
        SELECT
            pm.*,
            ip.apartamento AS item_apartamento,
            ip.piso AS item_piso,
            ip.nombre AS item_nombre,
            ip.nombre AS mueble_nombre,
            CONCAT(
                ip.nombre,
                CASE WHEN ip.piso IS NOT NULL THEN CONCAT(' - Piso ', ip.piso) ELSE '' END,
                CASE WHEN ip.apartamento IS NOT NULL THEN CONCAT(' - Apto ', ip.apartamento) ELSE '' END
            ) AS item_label,
            TRUE AS editable_llegada,
            'pieza' AS tipo_checklist
        FROM {_schema_table("piezas_mueble")} pm
        LEFT JOIN {_schema_table("items_proyecto")} ip
            ON ip.id = pm.items_proyecto_id
        WHERE {where_sql}
        ORDER BY
            ip.apartamento NULLS LAST,
            ip.nombre NULLS LAST,
            pm.pieza NULLS LAST,
            pm.id
        """,
        params,
    )


def agregar_pieza_mueble(
    db: Session,
    lote_id: int,
    items_proyecto_id: int,
    pieza: str,
    cantidad: float,
    llegada: bool = False,
    pieza_id: int | None = None,
    largo_mm: float | None = None,
    ancho_mm: float | None = None,
    espesor_mm: float | None = None,
    material: str | None = None,
    descripcion_original: str | None = None,
    notas: str | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    if cantidad <= 0:
        return {"ok": False, "mensaje": "La cantidad debe ser mayor a cero."}

    columns = _get_columns(db, "piezas_mueble")

    values = {
        "lote_id": lote_id,
        "items_proyecto_id": items_proyecto_id,
        "pieza": pieza,
        "cantidad": cantidad,
        "llegada": llegada,
        "pieza_id": pieza_id,
        "largo_mm": largo_mm,
        "ancho_mm": ancho_mm,
        "espesor_mm": espesor_mm,
        "material": material,
        "descripcion_original": descripcion_original,
        "notas": notas,
    }

    insert_cols = []
    insert_vals = []
    params = {"llegada": llegada}

    for col, value in values.items():
        if col in columns:
            insert_cols.append(_qcol(col))
            param_name = col
            insert_vals.append(f":{param_name}")
            params[param_name] = value

    if "fecha_registro" in columns:
        insert_cols.append("fecha_registro")
        insert_vals.append("NOW()")

    if "fecha_llegada" in columns:
        insert_cols.append("fecha_llegada")
        insert_vals.append("CASE WHEN :llegada = TRUE THEN NOW() ELSE NULL END")

    if "created_at" in columns:
        insert_cols.append("created_at")
        insert_vals.append("NOW()")

    if "updated_at" in columns:
        insert_cols.append("updated_at")
        insert_vals.append("NOW()")

    row = db.execute(
        text(
            f"""
            INSERT INTO {_schema_table("piezas_mueble")} (
                {", ".join(insert_cols)}
            )
            VALUES (
                {", ".join(insert_vals)}
            )
            RETURNING *
            """
        ),
        params,
    ).mappings().first()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Pieza agregada correctamente.",
        "pieza": _dict(row) if row else None,
        "id": row.get("id") if row else None,
    }


def actualizar_llegada_pieza(
    db: Session,
    pieza_mueble_id: int | None = None,
    piezas_mueble_id: int | None = None,
    llegada: bool = False,
    usuario: str | None = None,
    observacion: str | None = None,
) -> dict[str, Any]:
    pieza_id_final = piezas_mueble_id or pieza_mueble_id

    if pieza_id_final is None:
        return {"ok": False, "mensaje": "No se recibió id de pieza_mueble."}

    columns = _get_columns(db, "piezas_mueble")

    sets = []
    params = {
        "pieza_mueble_id": pieza_id_final,
        "llegada": llegada,
    }

    if "llegada" in columns:
        sets.append("llegada = :llegada")

    if "fecha_llegada" in columns:
        if llegada:
            sets.append("fecha_llegada = COALESCE(fecha_llegada, NOW())")
        else:
            sets.append("fecha_llegada = NULL")

    if "updated_at" in columns:
        sets.append("updated_at = NOW()")

    if not sets:
        return {
            "ok": False,
            "mensaje": "No hay columnas válidas para actualizar llegada.",
        }

    row = db.execute(
        text(
            f"""
            UPDATE {_schema_table("piezas_mueble")}
            SET {", ".join(sets)}
            WHERE id = :pieza_mueble_id
            RETURNING *
            """
        ),
        params,
    ).mappings().first()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Llegada de pieza actualizada correctamente.",
        "pieza": _dict(row) if row else None,
    }


actualizar_llegada_pieza_mueble = actualizar_llegada_pieza


def completar_piezas_mueble(
    db: Session,
    lote_id: int,
    items_proyecto_id: int,
) -> dict[str, Any]:
    columns = _get_columns(db, "piezas_mueble")

    sets = []

    if "llegada" in columns:
        sets.append("llegada = TRUE")

    if "fecha_llegada" in columns:
        sets.append("fecha_llegada = COALESCE(fecha_llegada, NOW())")

    if "updated_at" in columns:
        sets.append("updated_at = NOW()")

    if not sets:
        return {"ok": False, "mensaje": "No hay columnas válidas para completar piezas."}

    rows = db.execute(
        text(
            f"""
            UPDATE {_schema_table("piezas_mueble")}
            SET {", ".join(sets)}
            WHERE lote_id = :lote_id
              AND items_proyecto_id = :items_proyecto_id
            RETURNING id
            """
        ),
        {
            "lote_id": lote_id,
            "items_proyecto_id": items_proyecto_id,
        },
    ).mappings().all()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Mueble marcado como completo.",
        "lote_id": lote_id,
        "items_proyecto_id": items_proyecto_id,
        "piezas_total": len(rows),
        "piezas_actualizadas": len(rows),
    }

def completar_piezas_apartamento(
    db: Session,
    lote_id: int,
    apartamento: str,
) -> dict[str, Any]:
    columns = _get_columns(db, "piezas_mueble")

    sets = []

    if "llegada" in columns:
        sets.append("llegada = TRUE")

    if "fecha_llegada" in columns:
        sets.append("fecha_llegada = COALESCE(fecha_llegada, NOW())")

    if "updated_at" in columns:
        sets.append("updated_at = NOW()")

    if not sets:
        return {
            "ok": False,
            "mensaje": "No hay columnas válidas para completar piezas del apartamento.",
        }

    rows = db.execute(
        text(
            f"""
            UPDATE {_schema_table("piezas_mueble")} pm
            SET {", ".join(sets)}
            FROM {_schema_table("items_proyecto")} ip
            WHERE pm.items_proyecto_id = ip.id
              AND pm.lote_id = :lote_id
              AND ip.lote_id = :lote_id
              AND TRIM(COALESCE(ip.apartamento, '')) = TRIM(:apartamento)
            RETURNING pm.id
            """
        ),
        {
            "lote_id": lote_id,
            "apartamento": apartamento,
        },
    ).mappings().all()

    db.commit()

    return {
        "ok": True,
        "mensaje": f"Se marcaron {len(rows)} piezas como recibidas para el apartamento {apartamento}.",
        "lote_id": lote_id,
        "apartamento": apartamento,
        "piezas_actualizadas": len(rows),
    }
# ============================================================
# HERRAJES INSTALACIÓN
# ============================================================

def _is_herraje_filter_sql() -> str:
    return """
    (
        LOWER(COALESCE(mc.categoria, '')) LIKE '%herraje%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%bisagra%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%corredera%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%manija%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%tornillo%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%soporte%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%riel%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%tarugo%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%mini fix%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%minifix%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%aventos%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%escurr%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%cubertero%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%condimentero%'
        OR LOWER(COALESCE(mc.nombre, '')) LIKE '%alacena%'
    )
    """


def _ensure_herrajes_llegada_table(db: Session) -> None:
    db.execute(
        text(
            f"""
            CREATE TABLE IF NOT EXISTS {_schema_table("herrajes_mueble_llegada")} (
                id SERIAL PRIMARY KEY,
                lote_proceso_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                material_id INTEGER NOT NULL,
                llegada BOOLEAN NOT NULL DEFAULT FALSE,
                fecha_llegada TIMESTAMP NULL,
                notas TEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        )
    )

    db.execute(
        text(
            f"""
            DELETE FROM {_schema_table("herrajes_mueble_llegada")} h
            USING {_schema_table("herrajes_mueble_llegada")} h2
            WHERE h.id > h2.id
              AND h.lote_proceso_id = h2.lote_proceso_id
              AND h.item_id = h2.item_id
              AND h.material_id = h2.material_id
            """
        )
    )

    db.execute(
        text(
            f"""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_herrajes_mueble_llegada_idx
            ON {_schema_table("herrajes_mueble_llegada")} (
                lote_proceso_id,
                item_id,
                material_id
            )
            """
        )
    )

    db.commit()


def sincronizar_herrajes_mueble_llegada(
    db: Session,
    lote_proceso_id: int | None = None,
) -> dict[str, Any]:
    _ensure_herrajes_llegada_table(db)

    if lote_proceso_id is None:
        return {
            "ok": True,
            "mensaje": "Tabla de herrajes validada correctamente.",
            "rowcount": 0,
        }

    lote_proceso = get_lote_proceso(db, lote_proceso_id)

    if not lote_proceso:
        return {"ok": False, "mensaje": "No existe lote_proceso."}

    lote_id = lote_proceso.get("lote_id")

    result = db.execute(
        text(
            f"""
            INSERT INTO {_schema_table("herrajes_mueble_llegada")} (
                lote_proceso_id,
                item_id,
                material_id,
                llegada,
                fecha_llegada,
                notas,
                created_at,
                updated_at
            )
            SELECT
                :lote_proceso_id,
                bi.item_id,
                bi.material_id,
                FALSE,
                NULL,
                'Creado automáticamente desde bom_items',
                NOW(),
                NOW()
            FROM {_schema_table("bom_items")} bi
            INNER JOIN {_schema_table("items_proyecto")} ip
                ON ip.id = bi.item_id
            LEFT JOIN {_schema_table("materiales_catalogo")} mc
                ON mc.id = bi.material_id
            WHERE ip.lote_id = :lote_id
              AND {_is_herraje_filter_sql()}
            GROUP BY bi.item_id, bi.material_id
            ON CONFLICT (lote_proceso_id, item_id, material_id)
            DO UPDATE SET updated_at = NOW()
            """
        ),
        {
            "lote_proceso_id": lote_proceso_id,
            "lote_id": lote_id,
        },
    )

    db.commit()

    return {
        "ok": True,
        "mensaje": "Herrajes sincronizados correctamente desde bom_items.",
        "rowcount": result.rowcount,
        "lote_proceso_id": lote_proceso_id,
    }


def actualizar_llegada_herraje(
    db: Session,
    lote_proceso_id: int,
    item_id: int,
    material_id: int,
    llegada: bool,
    notas: str | None = None,
) -> dict[str, Any]:
    _ensure_herrajes_llegada_table(db)

    row = db.execute(
        text(
            f"""
            INSERT INTO {_schema_table("herrajes_mueble_llegada")} (
                lote_proceso_id,
                item_id,
                material_id,
                llegada,
                fecha_llegada,
                notas,
                created_at,
                updated_at
            )
            VALUES (
                :lote_proceso_id,
                :item_id,
                :material_id,
                :llegada,
                CASE WHEN :llegada = TRUE THEN NOW() ELSE NULL END,
                :notas,
                NOW(),
                NOW()
            )
            ON CONFLICT (lote_proceso_id, item_id, material_id)
            DO UPDATE SET
                llegada = EXCLUDED.llegada,
                fecha_llegada = CASE WHEN EXCLUDED.llegada = TRUE THEN NOW() ELSE NULL END,
                notas = COALESCE(EXCLUDED.notas, herrajes_mueble_llegada.notas),
                updated_at = NOW()
            RETURNING *
            """
        ),
        {
            "lote_proceso_id": lote_proceso_id,
            "item_id": item_id,
            "material_id": material_id,
            "llegada": llegada,
            "notas": notas,
        },
    ).mappings().first()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Llegada de herraje actualizada correctamente.",
        "herraje": _dict(row) if row else None,
    }


def firmar_instalacion_mueble(
    db: Session,
    lote_proceso_id: int,
    item_id: int,
    responsable_id: int | None = None,
    nombre_responsable: str | None = None,
    firma_base64: str | None = None,
    observacion: str | None = None,
) -> dict[str, Any]:
    if not firma_base64 or not firma_base64.strip():
        return {
            "ok": False,
            "mensaje": "La firma es obligatoria.",
        }

    row = db.execute(
        text(
            f"""
            INSERT INTO {_schema_table("firmas_instalacion_mueble")} (
                lote_proceso_id,
                item_id,
                responsable_id,
                nombre_responsable,
                firma_base64,
                observacion,
                fecha_firma,
                created_at,
                updated_at
            )
            VALUES (
                :lote_proceso_id,
                :item_id,
                :responsable_id,
                :nombre_responsable,
                :firma_base64,
                :observacion,
                NOW(),
                NOW(),
                NOW()
            )
            ON CONFLICT (lote_proceso_id, item_id)
            DO UPDATE SET
                responsable_id = EXCLUDED.responsable_id,
                nombre_responsable = EXCLUDED.nombre_responsable,
                firma_base64 = EXCLUDED.firma_base64,
                observacion = EXCLUDED.observacion,
                fecha_firma = NOW(),
                updated_at = NOW()
            RETURNING id, lote_proceso_id, item_id, fecha_firma
            """
        ),
        {
            "lote_proceso_id": lote_proceso_id,
            "item_id": item_id,
            "responsable_id": responsable_id,
            "nombre_responsable": nombre_responsable,
            "firma_base64": firma_base64,
            "observacion": observacion,
        },
    ).mappings().first()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Firma registrada correctamente.",
        "firma": _dict(row) if row else None,
    }


def get_firma_instalacion_mueble(
    db: Session,
    lote_proceso_id: int,
    item_id: int,
) -> dict[str, Any]:
    row = _first(
        db,
        f"""
        SELECT
            id,
            lote_proceso_id,
            item_id,
            responsable_id,
            nombre_responsable,
            firma_base64,
            observacion,
            fecha_firma
        FROM {_schema_table("firmas_instalacion_mueble")}
        WHERE lote_proceso_id = :lote_proceso_id
          AND item_id = :item_id
        LIMIT 1
        """,
        {
            "lote_proceso_id": lote_proceso_id,
            "item_id": item_id,
        },
    )

    return {
        "ok": True,
        "firmado": row is not None,
        "firma": row,
    }

def firmar_instalacion_apartamento(
    db: Session,
    lote_proceso_id: int,
    lote_id: int | None,
    apartamento: str,
    cliente: str | None,
    responsable_id: int | None,
    nombre_responsable: str | None,
    firma_base64: str,
    observacion: str | None = None,
) -> dict[str, Any]:
    if not apartamento or not apartamento.strip():
        return {"ok": False, "mensaje": "El apartamento es obligatorio."}

    if not firma_base64 or not firma_base64.strip():
        return {"ok": False, "mensaje": "La firma es obligatoria."}

    row = db.execute(
        text(
            f"""
            INSERT INTO {_schema_table("firmas_instalacion_apartamento")} (
                lote_proceso_id,
                lote_id,
                apartamento,
                cliente,
                responsable_id,
                nombre_responsable,
                firma_base64,
                observacion,
                fecha_firma,
                created_at,
                updated_at
            )
            VALUES (
                :lote_proceso_id,
                :lote_id,
                :apartamento,
                :cliente,
                :responsable_id,
                :nombre_responsable,
                :firma_base64,
                :observacion,
                NOW(),
                NOW(),
                NOW()
            )
            ON CONFLICT (lote_proceso_id, apartamento)
            DO UPDATE SET
                lote_id = EXCLUDED.lote_id,
                cliente = EXCLUDED.cliente,
                responsable_id = EXCLUDED.responsable_id,
                nombre_responsable = EXCLUDED.nombre_responsable,
                firma_base64 = EXCLUDED.firma_base64,
                observacion = EXCLUDED.observacion,
                fecha_firma = NOW(),
                updated_at = NOW()
            RETURNING
                id,
                lote_proceso_id,
                lote_id,
                apartamento,
                cliente,
                responsable_id,
                nombre_responsable,
                observacion,
                fecha_firma
            """
        ),
        {
            "lote_proceso_id": lote_proceso_id,
            "lote_id": lote_id,
            "apartamento": apartamento.strip(),
            "cliente": cliente,
            "responsable_id": responsable_id,
            "nombre_responsable": nombre_responsable,
            "firma_base64": firma_base64,
            "observacion": observacion,
        },
    ).mappings().first()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Firma de apartamento registrada correctamente.",
        "firma": _dict(row) if row else None,
    }


def get_firmas_instalacion_apartamentos(
    db: Session,
    lote_proceso_id: int,
) -> dict[str, Any]:
    rows = _all(
        db,
        f"""
        SELECT
            id,
            lote_proceso_id,
            lote_id,
            apartamento,
            cliente,
            responsable_id,
            nombre_responsable,
            firma_base64,
            observacion,
            fecha_firma
        FROM {_schema_table("firmas_instalacion_apartamento")}
        WHERE lote_proceso_id = :lote_proceso_id
        ORDER BY apartamento
        """,
        {"lote_proceso_id": lote_proceso_id},
    )

    return {
        "ok": True,
        "firmas": rows,
    }

def _get_herrajes_por_lote(db, lote_id: int, lote_proceso_id: int) -> dict[int, list[dict]]:
    """
    Lee los herrajes directamente desde herrajes_mueble_llegada.

    Importante:
    - item_id en herrajes_mueble_llegada debe ser el id de items_proyecto.
    - No se filtra por categoría del material, porque la tabla ya representa
      los herrajes del checklist.
    """

    rows = _all(db, f"""
        SELECT
            hml.id AS herraje_llegada_id,
            hml.lote_proceso_id,
            hml.item_id,
            hml.material_id,
            hml.llegada,
            hml.fecha_llegada,
            hml.notas,

            ip.id AS items_proyecto_id,
            ip.nombre AS item_nombre,
            ip.piso AS item_piso,
            ip.apartamento AS item_apartamento,

            mc.nombre AS material_nombre,
            mc.categoria AS material_categoria,
            mc.unidad_medida,

            bi.cantidad_requerida

        FROM {_schema_table("herrajes_mueble_llegada")} hml

        INNER JOIN {_schema_table("items_proyecto")} ip
            ON ip.id = hml.item_id

        LEFT JOIN {_schema_table("materiales_catalogo")} mc
            ON mc.id = hml.material_id

        LEFT JOIN {_schema_table("bom_items")} bi
            ON bi.item_id = hml.item_id
           AND bi.material_id = hml.material_id

        WHERE hml.lote_proceso_id = :lote_proceso_id
          AND ip.lote_id = :lote_id

        ORDER BY
            ip.apartamento NULLS LAST,
            ip.nombre NULLS LAST,
            hml.item_id,
            COALESCE(mc.nombre, hml.material_id::text)
    """, {
        "lote_id": lote_id,
        "lote_proceso_id": lote_proceso_id,
    })

    resultado: dict[int, list[dict]] = {}

    for h in rows:
        item_id = h.get("item_id")
        material_id = h.get("material_id")

        if item_id is None or material_id is None:
            continue

        item_id_int = int(item_id)

        try:
            material_id_int = int(material_id)
        except Exception:
            material_id_int = None

        nombre_herraje = (
            h.get("material_nombre")
            or f"Herraje {material_id}"
        )

        resultado.setdefault(item_id_int, []).append({
            "id": f"herraje-{h.get('herraje_llegada_id')}",
            "herraje_llegada_id": h.get("herraje_llegada_id"),
            "tipo_checklist": "herraje",

            "items_proyecto_id": item_id_int,
            "item_id": item_id_int,
            "material_id": material_id_int,

            "pieza": nombre_herraje,
            "herraje_nombre": nombre_herraje,
            "categoria": h.get("material_categoria") or "Herraje",

            "cantidad": h.get("cantidad_requerida") or 1,
            "cantidad_requerida": h.get("cantidad_requerida") or 1,
            "unidad_medida": h.get("unidad_medida"),

            "llegada": bool(h.get("llegada")),
            "fecha_llegada": h.get("fecha_llegada"),
            "editable_llegada": True,
            "notas": h.get("notas"),
        })

    return resultado

def get_muebles_instalacion(
    db: Session,
    lote_proceso_id: int,
) -> list[dict[str, Any]]:
    lote_proceso = get_lote_proceso(db, lote_proceso_id)

    if not lote_proceso:
        return []

    lote_id = lote_proceso.get("lote_id")

    if lote_id is None:
        return []

    muebles = get_muebles_lote(db, int(lote_id))
    piezas = get_piezas_mueble(db, int(lote_id))
    herrajes_por_item = _get_herrajes_por_lote(db, int(lote_id), lote_proceso_id)

    # ============================================================
    # Responsables asignados por mueble en tareas_proceso
    # IMPORTANTE:
    # tareas_proceso no tiene items_proyecto_id, solo item_id.
    # ============================================================
    tareas_responsables = _all(
        db,
        f"""
        SELECT
            tp.id AS tarea_id,
            tp.lote_proceso_id,
            tp.item_id,
            tp.responsable_id,
            p.nombre AS responsable_nombre,
            tp.estado,
            tp.notas
        FROM {_schema_table("tareas_proceso")} tp
        LEFT JOIN {_schema_table("personas")} p
            ON p.id = tp.responsable_id
        WHERE tp.lote_proceso_id = :lote_proceso_id
        """,
        {
            "lote_proceso_id": lote_proceso_id,
        },
    )

    tareas_por_item: dict[int, dict[str, Any]] = {}

    for tarea in tareas_responsables:
        item_key = tarea.get("item_id")

        if item_key is None:
            continue

        tareas_por_item[int(item_key)] = tarea

    # ============================================================
    # Piezas por mueble
    # ============================================================
    piezas_por_item: dict[int, list[dict[str, Any]]] = {}

    for pieza in piezas:
        item_id = pieza.get("items_proyecto_id")

        if item_id is None:
            continue

        pieza["tipo_checklist"] = "pieza"
        pieza["editable_llegada"] = True
        piezas_por_item.setdefault(int(item_id), []).append(pieza)

    result = []

    for mueble in muebles:
        item_id = mueble.get("id") or mueble.get("item_id")

        if item_id is None:
            continue

        item_id_int = int(item_id)

        piezas_item = piezas_por_item.get(item_id_int, [])
        herrajes_item = herrajes_por_item.get(item_id_int, [])
        tarea = tareas_por_item.get(item_id_int)

        piezas_total = len(piezas_item)
        piezas_recibidas = sum(
            1 for p in piezas_item if _as_bool(p.get("llegada"))
        )

        herrajes_total = len(herrajes_item)
        herrajes_recibidos = sum(
            1 for h in herrajes_item if _as_bool(h.get("llegada"))
        )

        completo = (
            piezas_total > 0
            and piezas_total == piezas_recibidas
            and herrajes_recibidos == herrajes_total
        )

        result.append(
            {
                "item_id": item_id_int,
                "item_nombre": mueble.get("nombre"),
                "piso": mueble.get("piso"),
                "apartamento": mueble.get("apartamento"),
                "label": mueble.get("label") or mueble.get("nombre"),

                "tarea_id": tarea.get("tarea_id") if tarea else None,
                "responsable_id": tarea.get("responsable_id") if tarea else None,
                "responsable_nombre": tarea.get("responsable_nombre") if tarea else None,
                "estado": (
                    tarea.get("estado")
                    if tarea and tarea.get("estado")
                    else mueble.get("estado")
                ),

                "piezas": piezas_item,
                "herrajes": herrajes_item,
                "checklist_secciones": [
                    {
                        "titulo": "Piezas",
                        "tipo": "piezas",
                        "items": piezas_item,
                    },
                    {
                        "titulo": "Herrajes",
                        "tipo": "herrajes",
                        "items": herrajes_item,
                    },
                ],
                "piezas_total": piezas_total,
                "piezas_recibidas": piezas_recibidas,
                "herrajes_total": herrajes_total,
                "herrajes_recibidos": herrajes_recibidos,
                "completo": completo,
            }
        )

    return result


# ============================================================
# PROCESO GENERAL / PRODUCCIÓN
# ============================================================

def actualizar_proceso(
    db: Session,
    lote_proceso_id: int,
    responsable_id: int | None = None,
    maquina_id: int | None = None,
    estado: str | None = None,
    fecha_inicio_real: str | None = None,
    fecha_fin_real: str | None = None,
    motivos_bloqueo: str | None = None,
    motivo_bloqueo: str | None = None,
    notas: str | None = None,
) -> dict[str, Any]:
    columns = _get_columns(db, "lote_procesos")

    sets = []
    params: dict[str, Any] = {
        "lote_proceso_id": lote_proceso_id,
        "responsable_id": responsable_id,
        "maquina_id": maquina_id,
        "estado": estado,
        "fecha_inicio_real": fecha_inicio_real,
        "fecha_fin_real": fecha_fin_real,
        "motivo_bloqueo": motivos_bloqueo or motivo_bloqueo,
        "notas": notas,
    }

    for field in [
        "responsable_id",
        "maquina_id",
        "estado",
        "fecha_inicio_real",
        "fecha_fin_real",
        "motivo_bloqueo",
        "notas",
    ]:
        if field in columns and params.get(field) is not None:
            sets.append(f"{_qcol(field)} = :{field}")

    if not sets:
        return {"ok": False, "mensaje": "No hay campos válidos para actualizar proceso."}

    row = db.execute(
        text(
            f"""
            UPDATE {_schema_table("lote_procesos")}
            SET {", ".join(sets)}
            WHERE id = :lote_proceso_id
            RETURNING *
            """
        ),
        params,
    ).mappings().first()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Proceso actualizado correctamente.",
        "lote_proceso": _dict(row) if row else None,
    }


def finalizar_proceso(
    db: Session,
    lote_proceso_id: int,
    responsable_id: int | None = None,
    maquina_id: int | None = None,
    estado: str = "completado",
    fecha_fin_real: str | None = None,
    motivos_bloqueo: str | None = None,
    motivo_bloqueo: str | None = None,
    notas: str | None = None,
    consumos: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return actualizar_proceso(
        db=db,
        lote_proceso_id=lote_proceso_id,
        responsable_id=responsable_id,
        maquina_id=maquina_id,
        estado=estado,
        fecha_fin_real=fecha_fin_real or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        motivos_bloqueo=motivos_bloqueo,
        motivo_bloqueo=motivo_bloqueo,
        notas=notas,
    )


def iniciar_lote_proceso(
    db: Session,
    lote_proceso_id: int,
    responsable_id: int | None = None,
    maquina_id: int | None = None,
    notas: str | None = None,
) -> dict[str, Any]:
    return actualizar_proceso(
        db=db,
        lote_proceso_id=lote_proceso_id,
        responsable_id=responsable_id,
        maquina_id=maquina_id,
        estado="en_proceso",
        fecha_inicio_real=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        notas=notas,
    )


def finalizar_lote_proceso(
    db: Session,
    lote_proceso_id: int,
    notas: str | None = None,
) -> dict[str, Any]:
    return finalizar_proceso(
        db=db,
        lote_proceso_id=lote_proceso_id,
        estado="completado",
        fecha_fin_real=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        notas=notas,
    )


def registrar_produccion(
    db: Session,
    lote_proceso_id: int,
    tarea_id: int | None = None,
    responsable_id: int | None = None,
    maquina_id: int | None = None,
    estado: str | None = None,
    notas: str | None = None,
    usuario: str | None = None,
) -> dict[str, Any]:
    if not _table_exists(db, "registros_produccion"):
        return {"ok": False, "mensaje": "No existe la tabla registros_produccion."}

    lote_proceso = get_lote_proceso(db, lote_proceso_id)

    if not lote_proceso:
        return {"ok": False, "mensaje": "No existe lote_proceso."}

    columns = _get_columns(db, "registros_produccion")

    values = {
        "fecha": date.today(),
        "lote_id": lote_proceso.get("lote_id"),
        "proceso_id": lote_proceso.get("proceso_id"),
        "persona_id": responsable_id,
        "maquina_id": maquina_id,
        "novedad": notas,
        "tiene_bloqueo": estado == "bloqueado",
        "motivo_bloqueo": notas if estado == "bloqueado" else None,
    }

    insert_cols = []
    insert_vals = []
    params = {}

    for col, value in values.items():
        if col in columns and value is not None:
            insert_cols.append(_qcol(col))
            insert_vals.append(f":{col}")
            params[col] = value

    if "created_at" in columns:
        insert_cols.append("created_at")
        insert_vals.append("NOW()")

    if not insert_cols:
        return {"ok": False, "mensaje": "No hay columnas válidas para registrar producción."}

    row = db.execute(
        text(
            f"""
            INSERT INTO {_schema_table("registros_produccion")} (
                {", ".join(insert_cols)}
            )
            VALUES (
                {", ".join(insert_vals)}
            )
            RETURNING *
            """
        ),
        params,
    ).mappings().first()

    db.commit()

    return {"ok": True, "registro": _dict(row) if row else None}


# ============================================================
# PANTALLA AGRUPADA
# ============================================================

def get_pantalla_proceso(
    db: Session,
    lote_proceso_id: int,
    proceso_id: int,
    lote_id: int | None = None,
) -> dict[str, Any]:
    lote_proceso = get_lote_proceso(db, lote_proceso_id)

    if not lote_proceso:
        return {
            "ok": False,
            "mensaje": "No existe el lote_proceso.",
        }

    lote_id_final = lote_id or lote_proceso.get("lote_id")

    materiales = []

    if lote_id_final is not None:
        materiales = get_materiales_consumo_detalle(
            db=db,
            lote_id=int(lote_id_final),
            proceso_id=proceso_id,
        )

    return {
        "ok": True,
        "lote_proceso": lote_proceso,
        "responsables": get_responsables(db, proceso_id),
        "maquinas": get_maquinas(db, proceso_id),
        "tareas": get_tareas_proceso(db, lote_proceso_id),
        "materiales": materiales,
        "muebles_instalacion": get_muebles_instalacion(db, lote_proceso_id)
        if int(proceso_id) == 6
        else [],
    }


# ============================================================
# ALIASES COMPATIBILIDAD
# ============================================================

def get_proyectos_por_proceso(db: Session, proceso_id: int) -> list[dict[str, Any]]:
    return get_proyectos(db, proceso_id)


def get_lotes_por_proyecto_proceso(
    db: Session,
    proyecto_id: int,
    proceso_id: int,
) -> list[dict[str, Any]]:
    return get_lotes(db, proyecto_id, proceso_id)


def get_lotes_por_proyecto(db: Session, proyecto_id: int) -> list[dict[str, Any]]:
    return get_lotes(db, proyecto_id)


def get_responsables_proceso(db: Session, proceso_id: int) -> list[dict[str, Any]]:
    return get_responsables(db, proceso_id)


def get_maquinas_proceso(db: Session, proceso_id: int) -> list[dict[str, Any]]:
    return get_maquinas(db, proceso_id)


def obtener_tareas_proceso(db: Session, lote_proceso_id: int) -> list[dict[str, Any]]:
    return get_tareas_proceso(db, lote_proceso_id)


def obtener_materiales_consumo_detalle(
    db: Session,
    lote_id: int,
    proceso_id: int,
) -> list[dict[str, Any]]:
    return get_materiales_consumo_detalle(db, lote_id, proceso_id)


def obtener_muebles_instalacion(
    db: Session,
    lote_proceso_id: int,
) -> list[dict[str, Any]]:
    return get_muebles_instalacion(db, lote_proceso_id)

# ============================================================
# ACTAS CLIENTE INSTALACIÓN
# ============================================================

def guardar_acta_entrega_cliente(
    db: Session,
    lote_proceso_id: int,
    lote_id: int | None,
    cliente: str,
    lote_nombre: str | None,
    apartamentos: str,
    mensaje: str,
    obra1_nombre: str | None,
    obra1_cargo: str | None,
    obra1_firma_base64: str | None,
    obra2_nombre: str | None,
    obra2_cargo: str | None,
    obra2_firma_base64: str | None,
    allstar_nombre: str | None,
    allstar_cargo: str | None,
    allstar_firma_base64: str | None,
    comentario: str | None,
    nombre_archivo: str,
    tipo_archivo: str,
    azure_container: str,
    azure_blob_name: str,
    azure_blob_url: str,
    hash_sha256: str,
) -> dict[str, Any]:
    columns = _get_columns(db, "actas_cliente_instalacion")

    values = {
        "lote_proceso_id": lote_proceso_id,
        "lote_id": lote_id,
        "cliente": cliente,
        "lote_nombre": lote_nombre,
        "apartamentos": apartamentos,
        "mensaje": mensaje,

        "comentario": comentario,

        "obra_persona_1_nombre": obra1_nombre,
        "obra_persona_1_cargo": obra1_cargo,
        "obra_persona_1_firma_base64": obra1_firma_base64,

        "obra_persona_2_nombre": obra2_nombre,
        "obra_persona_2_cargo": obra2_cargo,
        "obra_persona_2_firma_base64": obra2_firma_base64,

        "allstar_persona_nombre": allstar_nombre,
        "allstar_persona_cargo": allstar_cargo,
        "allstar_persona_firma_base64": allstar_firma_base64,

        "nombre_archivo": nombre_archivo,
        "tipo_archivo": tipo_archivo,
        "azure_container": azure_container,
        "azure_blob_name": azure_blob_name,
        "azure_blob_url": azure_blob_url,
        "hash_sha256": hash_sha256,
    }

    insert_cols = []
    insert_vals = []
    params: dict[str, Any] = {}

    for col, value in values.items():
        if col in columns:
            insert_cols.append(_qcol(col))
            insert_vals.append(f":{col}")
            params[col] = value

    if "fecha_firma" in columns:
        insert_cols.append("fecha_firma")
        insert_vals.append("NOW()")

    if "created_at" in columns:
        insert_cols.append("created_at")
        insert_vals.append("NOW()")

    if "updated_at" in columns:
        insert_cols.append("updated_at")
        insert_vals.append("NOW()")

    if not insert_cols:
        return {
            "ok": False,
            "mensaje": "No hay columnas válidas para guardar el acta.",
        }

    row = db.execute(
        text(
            f"""
            INSERT INTO {_schema_table("actas_cliente_instalacion")} (
                {", ".join(insert_cols)}
            )
            VALUES (
                {", ".join(insert_vals)}
            )
            RETURNING *
            """
        ),
        params,
    ).mappings().first()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Acta guardada correctamente en actas_cliente_instalacion y respaldada en Azure Blob Storage.",
        "acta": _dict(row) if row else None,
    }


def get_actas_entrega_cliente(
    db: Session,
    lote_proceso_id: int | None = None,
    lote_id: int | None = None,
) -> dict[str, Any]:
    if not _table_exists(db, "actas_cliente_instalacion"):
        return {
            "ok": False,
            "mensaje": "No existe la tabla actas_cliente_instalacion.",
            "actas": [],
        }

    filtros = []
    params: dict[str, Any] = {}

    if lote_proceso_id is not None:
        filtros.append("lote_proceso_id = :lote_proceso_id")
        params["lote_proceso_id"] = lote_proceso_id

    if lote_id is not None:
        filtros.append("lote_id = :lote_id")
        params["lote_id"] = lote_id

    where_sql = ""
    if filtros:
        where_sql = "WHERE " + " AND ".join(filtros)

    rows = db.execute(
        text(
            f"""
            SELECT *
            FROM {_schema_table("actas_cliente_instalacion")}
            {where_sql}
            ORDER BY COALESCE(created_at, fecha_firma) DESC
            """
        ),
        params,
    ).mappings().all()

    return {
        "ok": True,
        "actas": _list(rows),
    }


def get_acta_entrega_cliente_por_id(
    db: Session,
    acta_id: int,
) -> dict[str, Any] | None:
    row = db.execute(
        text(
            f"""
            SELECT *
            FROM {_schema_table("actas_cliente_instalacion")}
            WHERE id = :acta_id
            LIMIT 1
            """
        ),
        {"acta_id": acta_id},
    ).mappings().first()

    return _dict(row) if row else None



def actualizar_comentario_acta_cliente(
    db: Session,
    acta_id: int,
    comentario: str | None,
) -> dict[str, Any]:
    if not _table_exists(db, "actas_cliente_instalacion"):
        return {
            "ok": False,
            "mensaje": "No existe la tabla actas_cliente_instalacion.",
        }

    columns = _get_columns(db, "actas_cliente_instalacion")

    if "comentario" not in columns:
        return {
            "ok": False,
            "mensaje": "La columna comentario no existe en actas_cliente_instalacion.",
        }

    sets = ["comentario = :comentario"]
    params = {
        "acta_id": acta_id,
        "comentario": comentario,
    }

    if "comentario_updated_at" in columns:
        sets.append("comentario_updated_at = NOW()")

    if "updated_at" in columns:
        sets.append("updated_at = NOW()")

    row = db.execute(
        text(
            f"""
            UPDATE {_schema_table("actas_cliente_instalacion")}
            SET {", ".join(sets)}
            WHERE id = :acta_id
            RETURNING *
            """
        ),
        params,
    ).mappings().first()

    db.commit()

    if not row:
        return {
            "ok": False,
            "mensaje": "No se encontró el acta indicada.",
        }

    return {
        "ok": True,
        "mensaje": "Comentario actualizado correctamente.",
        "acta": _dict(row),
    }

def eliminar_acta_entrega_cliente(
    db,
    acta_id: int,
):
    schema = "carpentry"
    table_name = "actas_cliente_instalacion"

    # Primero consultamos el acta para poder devolver información útil
    acta = db.execute(
        text(
            f'''
            SELECT *
            FROM "{schema}"."{table_name}"
            WHERE id = :acta_id
            '''
        ),
        {"acta_id": acta_id},
    ).mappings().first()

    if not acta:
        return {
            "ok": False,
            "mensaje": f"No se encontró el acta cliente con ID {acta_id}.",
            "acta": None,
        }

    db.execute(
        text(
            f'''
            DELETE FROM "{schema}"."{table_name}"
            WHERE id = :acta_id
            '''
        ),
        {"acta_id": acta_id},
    )

    db.commit()

    return {
        "ok": True,
        "mensaje": f"Acta cliente ID {acta_id} eliminada correctamente de la base de datos.",
        "acta": dict(acta),
    }


def registrar_consumo_sin_lote(
    db: Session,
    proyecto_id: int,
    proyecto_nombre: str | None,
    cliente: str | None,
    proceso_nombre: str,
    tipo_material: str,
    nombre_produccion: str,
    material_id: int,
    material_nombre: str | None,
    unidad_medida: str | None,
    cantidad_consumida: float,
    ubicacion: str | None = None,
    observacion: str | None = None,
    usuario: str | None = "tablet",
) -> dict[str, Any]:
    if not _table_exists(db, "consumos_sin_lote"):
        return {
            "ok": False,
            "mensaje": "No existe la tabla consumos_sin_lote.",
        }

    if not _table_exists(db, "inventario"):
        return {
            "ok": False,
            "mensaje": "No existe la tabla inventario.",
        }

    if cantidad_consumida is None or cantidad_consumida <= 0:
        return {
            "ok": False,
            "mensaje": "La cantidad consumida debe ser mayor a cero.",
        }

    if not nombre_produccion or not nombre_produccion.strip():
        return {
            "ok": False,
            "mensaje": "Debe indicar el nombre de lo que se está produciendo.",
        }

    inventario = _first(
        db,
        f"""
        SELECT
            i.id AS inventario_id,
            i.material_id,
            COALESCE(i.cantidad_disponible, 0) AS cantidad_disponible,
            i.ubicacion,
            mc.nombre AS material_nombre,
            mc.categoria,
            mc.unidad_medida
        FROM {_schema_table("inventario")} i
        LEFT JOIN {_schema_table("materiales_catalogo")} mc
            ON mc.id = i.material_id
        WHERE i.material_id = :material_id
          AND (
                :ubicacion IS NULL
                OR TRIM(COALESCE(i.ubicacion, '')) = TRIM(:ubicacion)
              )
        ORDER BY COALESCE(i.cantidad_disponible, 0) DESC, i.id
        LIMIT 1
        """,
        {
            "material_id": material_id,
            "ubicacion": ubicacion,
        },
    )

    if not inventario:
        return {
            "ok": False,
            "mensaje": "No se encontró inventario para el material seleccionado.",
        }

    cantidad_disponible = float(inventario.get("cantidad_disponible") or 0)

    if cantidad_consumida > cantidad_disponible:
        return {
            "ok": False,
            "mensaje": f"Inventario insuficiente. Disponible: {cantidad_disponible}.",
            "cantidad_disponible": cantidad_disponible,
        }

    inventario_id = inventario.get("inventario_id")

    db.execute(
        text(
            f"""
            UPDATE {_schema_table("inventario")}
            SET
                cantidad_disponible = COALESCE(cantidad_disponible, 0) - :cantidad_consumida,
                ultima_actualizacion = NOW()
            WHERE id = :inventario_id
            """
        ),
        {
            "inventario_id": inventario_id,
            "cantidad_consumida": cantidad_consumida,
        },
    )

    row = db.execute(
        text(
            f"""
            INSERT INTO {_schema_table("consumos_sin_lote")} (
                proyecto_id,
                proyecto_nombre,
                cliente,
                proceso_nombre,
                tipo_material,
                nombre_produccion,
                material_id,
                material_nombre,
                unidad_medida,
                cantidad_consumida,
                ubicacion,
                observacion,
                usuario,
                created_at
            )
            VALUES (
                :proyecto_id,
                :proyecto_nombre,
                :cliente,
                :proceso_nombre,
                :tipo_material,
                :nombre_produccion,
                :material_id,
                :material_nombre,
                :unidad_medida,
                :cantidad_consumida,
                :ubicacion,
                :observacion,
                :usuario,
                NOW()
            )
            RETURNING *
            """
        ),
        {
            "proyecto_id": proyecto_id,
            "proyecto_nombre": proyecto_nombre,
            "cliente": cliente,
            "proceso_nombre": proceso_nombre,
            "tipo_material": tipo_material,
            "nombre_produccion": nombre_produccion.strip(),
            "material_id": material_id,
            "material_nombre": material_nombre or inventario.get("material_nombre"),
            "unidad_medida": unidad_medida or inventario.get("unidad_medida"),
            "cantidad_consumida": cantidad_consumida,
            "ubicacion": ubicacion or inventario.get("ubicacion"),
            "observacion": observacion,
            "usuario": usuario or "tablet",
        },
    ).mappings().first()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Consumo sin lote registrado y descontado del inventario correctamente.",
        "consumo": _dict(row) if row else None,
        "cantidad_disponible_anterior": cantidad_disponible,
        "cantidad_disponible_nueva": cantidad_disponible - cantidad_consumida,
    }

def get_consumos_sin_lote(
    db: Session,
    proyecto_id: int | None = None,
) -> dict[str, Any]:
    if not _table_exists(db, "consumos_sin_lote"):
        return {
            "ok": False,
            "mensaje": "No existe la tabla consumos_sin_lote.",
            "consumos": [],
        }

    filtros = []
    params: dict[str, Any] = {}

    if proyecto_id is not None:
        filtros.append("proyecto_id = :proyecto_id")
        params["proyecto_id"] = proyecto_id

    where_sql = ""
    if filtros:
        where_sql = "WHERE " + " AND ".join(filtros)

    rows = _all(
        db,
        f"""
        SELECT *
        FROM {_schema_table("consumos_sin_lote")}
        {where_sql}
        ORDER BY created_at DESC, id DESC
        """,
        params,
    )

    return {
        "ok": True,
        "consumos": rows,
    }


def guardar_plano_proyecto(
    db: Session,
    proyecto_id: int,
    lote_id: int | None,
    proyecto_nombre: str | None,
    lote_nombre: str | None,
    cliente: str | None,
    nombre_plano: str,
    descripcion: str | None,
    nombre_archivo: str,
    tipo_archivo: str | None,
    azure_container: str | None,
    azure_blob_name: str | None,
    azure_blob_url: str | None,
    hash_sha256: str | None,
    usuario: str | None = "sistema",
) -> dict[str, Any]:
    if not _table_exists(db, "planos_proyecto"):
        return {
            "ok": False,
            "mensaje": "No existe la tabla planos_proyecto.",
        }

    if not nombre_plano or not nombre_plano.strip():
        return {
            "ok": False,
            "mensaje": "Debe indicar el nombre del plano.",
        }

    if not nombre_archivo or not nombre_archivo.strip():
        return {
            "ok": False,
            "mensaje": "Debe indicar el nombre del archivo.",
        }

    row = db.execute(
        text(
            f"""
            INSERT INTO {_schema_table("planos_proyecto")} (
                proyecto_id,
                lote_id,
                proyecto_nombre,
                lote_nombre,
                cliente,
                nombre_plano,
                descripcion,
                nombre_archivo,
                tipo_archivo,
                azure_container,
                azure_blob_name,
                azure_blob_url,
                hash_sha256,
                usuario,
                activo,
                created_at,
                updated_at
            )
            VALUES (
                :proyecto_id,
                :lote_id,
                :proyecto_nombre,
                :lote_nombre,
                :cliente,
                :nombre_plano,
                :descripcion,
                :nombre_archivo,
                :tipo_archivo,
                :azure_container,
                :azure_blob_name,
                :azure_blob_url,
                :hash_sha256,
                :usuario,
                TRUE,
                NOW(),
                NOW()
            )
            RETURNING *
            """
        ),
        {
            "proyecto_id": proyecto_id,
            "lote_id": lote_id,
            "proyecto_nombre": proyecto_nombre,
            "lote_nombre": lote_nombre,
            "cliente": cliente,
            "nombre_plano": nombre_plano.strip(),
            "descripcion": descripcion,
            "nombre_archivo": nombre_archivo,
            "tipo_archivo": tipo_archivo or "application/pdf",
            "azure_container": azure_container,
            "azure_blob_name": azure_blob_name,
            "azure_blob_url": azure_blob_url,
            "hash_sha256": hash_sha256,
            "usuario": usuario or "sistema",
        },
    ).mappings().first()

    db.commit()

    return {
        "ok": True,
        "mensaje": "Plano registrado correctamente.",
        "plano": _dict(row) if row else None,
    }


def get_planos_proyecto(
    db: Session,
    proyecto_id: int,
    lote_id: int | None = None,
) -> dict[str, Any]:
    if not _table_exists(db, "planos_proyecto"):
        return {
            "ok": False,
            "mensaje": "No existe la tabla planos_proyecto.",
            "planos": [],
        }

    filtros = [
        "proyecto_id = :proyecto_id",
        "activo = TRUE",
    ]

    params: dict[str, Any] = {
        "proyecto_id": proyecto_id,
    }

    if lote_id is not None:
        filtros.append("lote_id = :lote_id")
        params["lote_id"] = lote_id

    rows = _all(
        db,
        f"""
        SELECT *
        FROM {_schema_table("planos_proyecto")}
        WHERE {" AND ".join(filtros)}
        ORDER BY created_at DESC, id DESC
        """,
        params,
    )

    return {
        "ok": True,
        "planos": rows,
    }


def get_plano_proyecto_por_id(
    db: Session,
    plano_id: int,
) -> dict[str, Any]:
    if not _table_exists(db, "planos_proyecto"):
        return {
            "ok": False,
            "mensaje": "No existe la tabla planos_proyecto.",
        }

    row = _first(
        db,
        f"""
        SELECT *
        FROM {_schema_table("planos_proyecto")}
        WHERE id = :plano_id
          AND activo = TRUE
        LIMIT 1
        """,
        {"plano_id": plano_id},
    )

    if not row:
        return {
            "ok": False,
            "mensaje": "No se encontró el plano indicado.",
        }

    return {
        "ok": True,
        "plano": row,
    }


def eliminar_plano_proyecto(
    db: Session,
    plano_id: int,
) -> dict[str, Any]:
    if not _table_exists(db, "planos_proyecto"):
        return {
            "ok": False,
            "mensaje": "No existe la tabla planos_proyecto.",
        }

    row = db.execute(
        text(
            f"""
            UPDATE {_schema_table("planos_proyecto")}
            SET
                activo = FALSE,
                updated_at = NOW()
            WHERE id = :plano_id
            RETURNING *
            """
        ),
        {"plano_id": plano_id},
    ).mappings().first()

    db.commit()

    if not row:
        return {
            "ok": False,
            "mensaje": "No se encontró el plano indicado.",
        }

    return {
        "ok": True,
        "mensaje": "Plano eliminado correctamente.",
        "plano": _dict(row),
    }
