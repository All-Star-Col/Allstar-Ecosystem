from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging_config import get_logger
from src.services.carpentry.common import (
    AppError,
    build_where,
    clean,
    execute,
    fetch_all,
    int_or_none,
    decimal_or_none,
    to_bool,
)

logger = get_logger(__name__)


async def listar_personas(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    where_sql, values, _ = build_where(
        {
            "proceso_id": filters.get("proceso_id"),
            "area_id": filters.get("area_id"),
            "activo": filters.get("activo"),
        },
        {
            "proceso_id": "p.proceso_id",
            "area_id": "p.area_id",
            "activo": "p.activo",
        },
    )

    return await fetch_all(
        db,
        f"""WITH rp_personas AS (
               SELECT rpp.registro_id, rpp.persona_id
               FROM registros_produccion_personas rpp
               UNION ALL
               SELECT rp.id AS registro_id, rp.persona_id
               FROM registros_produccion rp
               WHERE rp.persona_id IS NOT NULL
                 AND NOT EXISTS (
                   SELECT 1
                   FROM registros_produccion_personas rpp
                   WHERE rpp.registro_id = rp.id
                 )
             )
             SELECT p.id, p.nombre, p.proceso_id, pr.nombre AS proceso,
                    p.area_id, a.nombre AS area,
                    p.horas_dia_disponibles, p.activo,
                    COUNT(DISTINCT rel.registro_id)::INTEGER AS registros_produccion
             FROM personas p
             LEFT JOIN procesos pr ON pr.id = p.proceso_id
             LEFT JOIN areas a ON a.id = p.area_id
             LEFT JOIN rp_personas rel ON rel.persona_id = p.id
             {where_sql}
             GROUP BY p.id, pr.nombre, a.nombre
             ORDER BY p.nombre""",
        values,
    )


async def guardar_persona(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}

    data = {
        "id": int_or_none(payload.get("id")),
        "nombre": clean(payload.get("nombre")),
        "area_id": int_or_none(payload.get("area_id")),
        "proceso_id": int_or_none(payload.get("proceso_id")),
        "horas_dia_disponibles": decimal_or_none(payload.get("horas_dia_disponibles")) or 8.0,
        "activo": True if payload.get("activo") is None else to_bool(payload.get("activo")),
    }

    if not data["nombre"]:
        raise AppError("El nombre de la persona es obligatorio.", 400, "VALIDATION")

    async with db.begin():
        if data["id"]:
            rows = await execute(
                db,
                """UPDATE personas
                   SET nombre = $1,
                       area_id = $2,
                       proceso_id = $3,
                       horas_dia_disponibles = $4,
                       activo = $5
                   WHERE id = $6
                   RETURNING id""",
                [
                    data["nombre"],
                    data["area_id"],
                    data["proceso_id"],
                    data["horas_dia_disponibles"],
                    data["activo"],
                    data["id"],
                ],
            )

            if not rows:
                raise AppError("Persona no encontrada.", 404, "NOT_FOUND")

            return {"id": rows[0]["id"], "creado": False}

        rows = await execute(
            db,
            """INSERT INTO personas (nombre, area_id, proceso_id, horas_dia_disponibles, activo)
               VALUES ($1,$2,$3,$4,$5)
               RETURNING id""",
            [
                data["nombre"],
                data["area_id"],
                data["proceso_id"],
                data["horas_dia_disponibles"],
                data["activo"],
            ],
        )

    return {"id": rows[0]["id"], "creado": True}


async def desactivar_persona(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}

    async with db.begin():
        rows = await execute(
            db,
            "UPDATE personas SET activo = FALSE WHERE id = $1 RETURNING id",
            [payload.get("id")],
        )

    if not rows:
        raise AppError("Persona no encontrada.", 404, "NOT_FOUND")

    return {"ok": True}


async def listar_maquinas(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    where_sql, values, _ = build_where(
        {
            "proceso_id": filters.get("proceso_id"),
            "activo": filters.get("activo"),
        },
        {
            "proceso_id": "m.proceso_id",
            "activo": "m.activo",
        },
    )

    return await fetch_all(
        db,
        f"""WITH rp_maquinas AS (
               SELECT rpm.registro_id, rpm.maquina_id
               FROM registros_produccion_maquinas rpm
               UNION ALL
               SELECT rp.id AS registro_id, rp.maquina_id
               FROM registros_produccion rp
               WHERE rp.maquina_id IS NOT NULL
                 AND NOT EXISTS (
                   SELECT 1
                   FROM registros_produccion_maquinas rpm
                   WHERE rpm.registro_id = rp.id
                 )
             )
             SELECT m.id, m.nombre, m.proceso_id, pr.nombre AS proceso,
                    m.horas_dia_disponibles, m.activo,
                    COUNT(DISTINCT rel.registro_id)::INTEGER AS registros_produccion
             FROM maquinas m
             LEFT JOIN procesos pr ON pr.id = m.proceso_id
             LEFT JOIN rp_maquinas rel ON rel.maquina_id = m.id
             {where_sql}
             GROUP BY m.id, pr.nombre
             ORDER BY m.nombre""",
        values,
    )


async def guardar_maquina(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}

    data = {
        "id": int_or_none(payload.get("id")),
        "nombre": clean(payload.get("nombre")),
        "proceso_id": int_or_none(payload.get("proceso_id")),
        "horas_dia_disponibles": decimal_or_none(payload.get("horas_dia_disponibles")) or 8.0,
        "activo": True if payload.get("activo") is None else to_bool(payload.get("activo")),
    }

    if not data["nombre"] or not data["proceso_id"]:
        raise AppError("Nombre y proceso son obligatorios para la máquina.", 400, "VALIDATION")

    async with db.begin():
        if data["id"]:
            rows = await execute(
                db,
                """UPDATE maquinas
                   SET nombre = $1,
                       proceso_id = $2,
                       horas_dia_disponibles = $3,
                       activo = $4
                   WHERE id = $5
                   RETURNING id""",
                [
                    data["nombre"],
                    data["proceso_id"],
                    data["horas_dia_disponibles"],
                    data["activo"],
                    data["id"],
                ],
            )

            if not rows:
                raise AppError("Máquina no encontrada.", 404, "NOT_FOUND")

            return {"id": rows[0]["id"], "creado": False}

        rows = await execute(
            db,
            """INSERT INTO maquinas (nombre, proceso_id, horas_dia_disponibles, activo)
               VALUES ($1,$2,$3,$4)
               RETURNING id""",
            [
                data["nombre"],
                data["proceso_id"],
                data["horas_dia_disponibles"],
                data["activo"],
            ],
        )

    return {"id": rows[0]["id"], "creado": True}


async def desactivar_maquina(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}

    async with db.begin():
        rows = await execute(
            db,
            "UPDATE maquinas SET activo = FALSE WHERE id = $1 RETURNING id",
            [payload.get("id")],
        )

    if not rows:
        raise AppError("Máquina no encontrada.", 404, "NOT_FOUND")

    return {"ok": True}


async def listar_carga_semanal(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    params = []
    clauses = []

    if filters.get("proceso"):
        params.append(filters["proceso"])
        clauses.append(f"proceso = ${len(params)}")

    if filters.get("tipo_recurso"):
        params.append(filters["tipo_recurso"])
        clauses.append(f"tipo_recurso = ${len(params)}")

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    return await fetch_all(
        db,
        f"""SELECT tipo_recurso, recurso_id, recurso, proceso,
                  capacidad_semanal_horas,
                  lotes_en_proceso,
                  horas_carga_estimada,
                  COALESCE(pct_ocupacion_planificada, 0) AS pct_ocupacion_planificada,
                  horas_registradas_semana,
                  lotes_activos,
                  COALESCE(pct_ocupacion_real, 0)        AS pct_ocupacion_real
           FROM vista_carga_activa
           {where_sql}
           ORDER BY proceso, tipo_recurso, recurso""",
        params,
    )
