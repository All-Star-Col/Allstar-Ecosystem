from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.services.carpentry.common import (
    AppError,
    clean,
    date_or_none,
    execute,
    fetch_all,
    fetch_one,
    int_or_none,
)


def _first_int(payload: dict[str, Any], *keys: str) -> int | None:
    for key in keys:
        value = int_or_none(payload.get(key))
        if value is not None:
            return value
    return None


def _first_value(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = clean(payload.get(key))
        if value not in (None, ""):
            return value
    return None


async def get_health(db: AsyncSession) -> dict[str, Any]:
    row = await fetch_one(
        db,
        "SELECT current_database() AS database, current_schema() AS schema, current_user AS user",
    )
    return {
        "ok": True,
        "database": (row or {}).get("database"),
        "schema": (row or {}).get("schema"),
        "user": (row or {}).get("user"),
        "environment": settings.ENVIRONMENT,
    }


async def get_procesos(db: AsyncSession, piso: int) -> list[dict[str, Any]]:
    rows = await fetch_all(
        db,
        """SELECT id, nombre, orden_linea, capacidad_horas_dia
           FROM procesos
           ORDER BY orden_linea ASC NULLS LAST, id ASC""",
    )
    return [{**row, "piso": piso} for row in rows]


async def get_proyectos(db: AsyncSession, proceso_id: int) -> list[dict[str, Any]]:
    return await fetch_all(
        db,
        """SELECT DISTINCT p.id, p.nombre, p.cliente, p.estado, p.fecha_compromiso
           FROM proyectos p
           JOIN lotes l ON l.proyecto_id = p.id
           LEFT JOIN lote_procesos lp ON lp.lote_id = l.id
           WHERE p.estado <> 'finalizado'
             AND (
                l.proceso_actual_id = $1
                OR lp.proceso_id = $1
             )
           ORDER BY p.nombre ASC""",
        [proceso_id],
    )


async def get_lotes(
    db: AsyncSession,
    *,
    proyecto_id: int,
    proceso_id: int,
) -> list[dict[str, Any]]:
    return await fetch_all(
        db,
        """SELECT l.id,
                  l.nombre,
                  l.estado,
                  l.proyecto_id,
                  l.proceso_actual_id,
                  lp.id AS lote_proceso_id,
                  lp.estado AS estado_proceso,
                  lp.fecha_inicio_real,
                  lp.fecha_fin_real,
                  lp.responsable_id,
                  per.nombre AS responsable,
                  lp.maquina_id,
                  maq.nombre AS maquina
           FROM lotes l
           LEFT JOIN lote_procesos lp
             ON lp.lote_id = l.id
            AND lp.proceso_id = $2
           LEFT JOIN personas per ON per.id = lp.responsable_id
           LEFT JOIN maquinas maq ON maq.id = lp.maquina_id
           WHERE l.proyecto_id = $1
             AND l.estado IN ('pendiente','en_produccion','bloqueado','empacado','instalacion','despachado')
             AND (
                l.proceso_actual_id = $2
                OR lp.proceso_id = $2
             )
           ORDER BY l.prioridad ASC, l.fecha_entrega_prog ASC NULLS LAST, l.nombre ASC""",
        [proyecto_id, proceso_id],
    )


async def get_lote_proceso(
    db: AsyncSession,
    lote_proceso_id: int,
) -> dict[str, Any]:
    row = await fetch_one(
        db,
        """SELECT lp.id,
                  lp.lote_id,
                  l.nombre AS lote,
                  l.proyecto_id,
                  p.nombre AS proyecto,
                  lp.proceso_id,
                  pr.nombre AS proceso,
                  lp.orden,
                  lp.estado,
                  lp.fecha_programada,
                  lp.fecha_inicio_real,
                  lp.fecha_fin_real,
                  lp.responsable_id,
                  per.nombre AS responsable,
                  lp.maquina_id,
                  maq.nombre AS maquina,
                  lp.motivo_bloqueo,
                  lp.notas
           FROM lote_procesos lp
           JOIN lotes l ON l.id = lp.lote_id
           JOIN proyectos p ON p.id = l.proyecto_id
           JOIN procesos pr ON pr.id = lp.proceso_id
           LEFT JOIN personas per ON per.id = lp.responsable_id
           LEFT JOIN maquinas maq ON maq.id = lp.maquina_id
           WHERE lp.id = $1""",
        [lote_proceso_id],
    )
    if not row:
        raise AppError("Proceso de lote no encontrado.", 404, "NOT_FOUND")
    return row


async def get_responsables(db: AsyncSession, proceso_id: int) -> list[dict[str, Any]]:
    return await fetch_all(
        db,
        """SELECT id, nombre, area_id, proceso_id, horas_dia_disponibles
           FROM personas
           WHERE activo = TRUE
             AND (proceso_id = $1 OR proceso_id IS NULL)
           ORDER BY nombre ASC""",
        [proceso_id],
    )


async def get_maquinas(db: AsyncSession, proceso_id: int) -> list[dict[str, Any]]:
    return await fetch_all(
        db,
        """SELECT id, nombre, proceso_id, horas_dia_disponibles
           FROM maquinas
           WHERE activo = TRUE
             AND proceso_id = $1
           ORDER BY nombre ASC""",
        [proceso_id],
    )


async def get_materiales_consumo(
    db: AsyncSession,
    *,
    lote_id: int,
    proceso_id: int,
) -> list[dict[str, Any]]:
    return await fetch_all(
        db,
        """SELECT mc.id AS material_id,
                  COALESCE(vnm.material, mc.nombre) AS material,
                  mc.categoria,
                  mc.unidad_medida,
                  vnm.cantidad_requerida,
                  vnm.cantidad_en_bodega,
                  vnm.cantidad_pendiente,
                  vnm.material_disponible,
                  $2::INTEGER AS proceso_id
           FROM vista_necesidades_materiales vnm
           LEFT JOIN materiales_catalogo mc
             ON lower(mc.nombre) = lower(vnm.material)
           WHERE vnm.lote_id = $1
           ORDER BY mc.categoria NULLS LAST, vnm.material ASC""",
        [lote_id, proceso_id],
    )


async def get_inventario(db: AsyncSession, categoria: str | None = None) -> list[dict[str, Any]]:
    params: list[Any] = []
    where = ""
    if categoria:
        params.append(categoria)
        where = "WHERE mc.categoria = $1"

    return await fetch_all(
        db,
        f"""SELECT mc.id AS material_id,
                   mc.nombre AS material,
                   mc.categoria,
                   mc.unidad_medida,
                   mc.activo,
                   COALESCE(i.cantidad_actual, 0) AS cantidad_actual,
                   i.ubicacion
            FROM materiales_catalogo mc
            LEFT JOIN inventario i ON i.material_id = mc.id
            {where}
            ORDER BY mc.categoria ASC, mc.nombre ASC""",
        params,
    )


async def actualizar_proceso(
    db: AsyncSession,
    payload: dict[str, Any],
) -> dict[str, Any]:
    lote_proceso_id = _first_int(payload, "lote_proceso_id", "id")
    if not lote_proceso_id:
        raise AppError("Falta lote_proceso_id.", 400, "VALIDATION")

    responsable_id = _first_int(payload, "responsable_id", "persona_id")
    maquina_id = _first_int(payload, "maquina_id")
    fecha_inicio = date_or_none(
        _first_value(payload, "fecha_inicio_real", "fecha_inicio")
    )
    notas = _first_value(payload, "notas", "comentario")
    estado = _first_value(payload, "estado") or "en_produccion"

    async with db.begin():
        rows = await execute(
            db,
            """UPDATE lote_procesos
               SET responsable_id = COALESCE($1, responsable_id),
                   maquina_id = COALESCE($2, maquina_id),
                   fecha_inicio_real = COALESCE($3, fecha_inicio_real, CURRENT_DATE),
                   notas = COALESCE($4, notas),
                   estado = COALESCE($5, estado)
               WHERE id = $6
               RETURNING id, lote_id, proceso_id, estado""",
            [responsable_id, maquina_id, fecha_inicio, notas, estado, lote_proceso_id],
        )
        if not rows:
            raise AppError("Proceso de lote no encontrado.", 404, "NOT_FOUND")

        await execute(
            db,
            """UPDATE lotes
               SET estado = CASE WHEN estado = 'pendiente' THEN 'en_produccion' ELSE estado END,
                   proceso_actual_id = COALESCE(proceso_actual_id, $1)
               WHERE id = $2""",
            [rows[0]["proceso_id"], rows[0]["lote_id"]],
        )

    return {"ok": True, "proceso": rows[0]}


async def finalizar_proceso(
    db: AsyncSession,
    payload: dict[str, Any],
) -> dict[str, Any]:
    lote_proceso_id = _first_int(payload, "lote_proceso_id", "id")
    if not lote_proceso_id:
        raise AppError("Falta lote_proceso_id.", 400, "VALIDATION")

    fecha_fin = date_or_none(_first_value(payload, "fecha_fin_real", "fecha_finalizado"))
    notas = _first_value(payload, "notas", "comentario")

    async with db.begin():
        proceso_rows = await execute(
            db,
            """UPDATE lote_procesos
               SET estado = 'finalizado',
                   fecha_fin_real = COALESCE($1, CURRENT_DATE),
                   notas = COALESCE($2, notas)
               WHERE id = $3
               RETURNING id, lote_id, proceso_id, orden""",
            [fecha_fin, notas, lote_proceso_id],
        )
        if not proceso_rows:
            raise AppError("Proceso de lote no encontrado.", 404, "NOT_FOUND")

        proceso = proceso_rows[0]
        siguiente = await fetch_one(
            db,
            """SELECT id, proceso_id
               FROM lote_procesos
               WHERE lote_id = $1
                 AND estado <> 'finalizado'
               ORDER BY orden ASC
               LIMIT 1""",
            [proceso["lote_id"]],
        )

        if siguiente:
            await execute(
                db,
                """UPDATE lotes
                   SET estado = 'en_produccion',
                       proceso_actual_id = $1
                   WHERE id = $2""",
                [siguiente["proceso_id"], proceso["lote_id"]],
            )
        else:
            await execute(
                db,
                """UPDATE lotes
                   SET estado = 'finalizado',
                       fecha_entrega_real = COALESCE(fecha_entrega_real, CURRENT_DATE),
                       proceso_actual_id = NULL
                   WHERE id = $1""",
                [proceso["lote_id"]],
            )

    return {"ok": True, "proceso": proceso, "siguiente": siguiente}
