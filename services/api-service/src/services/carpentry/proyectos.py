from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging_config import get_logger
from src.services.carpentry.common import AppError, build_where, clean, execute, fetch_all, fetch_one

logger = get_logger(__name__)


def _date_or_none(value):
    value = clean(value)
    if value is None:
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text[:10]).date()
    except ValueError as exc:
        raise AppError(
            f"Fecha inválida: {value}",
            400,
            "VALIDATION_DATE",
        ) from exc


def _int_or_none(value, field_name: str) -> int | None:
    value = clean(value)
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise AppError(
            f"Valor inválido para {field_name}.",
            400,
            "VALIDATION",
        ) from exc


def _normalize_input(data: dict) -> dict:
    return {
        "nombre": clean(data.get("nombre")),
        "cliente": clean(data.get("cliente")),
        "fecha_inicio": _date_or_none(data.get("fecha_inicio")),
        "fecha_compromiso": _date_or_none(data.get("fecha_compromiso")),
        "fecha_fin": _date_or_none(data.get("fecha_fin")),
        "prioridad": int(data.get("prioridad") or 2),
        "responsable_id": _int_or_none(data.get("responsable_id"), "responsable_id"),
        "estado": clean(data.get("estado")) or "pendiente",
        "notas": clean(data.get("notas")),
    }


async def listar_proyectos(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}
    where_sql, values, _ = build_where(
        {
            "estado": filters.get("estado"),
            "prioridad": filters.get("prioridad"),
            "responsable_id": filters.get("responsable_id"),
        },
        {
            "estado": "p.estado",
            "prioridad": "p.prioridad",
            "responsable_id": "p.responsable_id",
        },
    )

    return await fetch_all(
        db,
        f"""SELECT p.id, p.nombre, p.cliente, p.estado, p.prioridad,
                  p.fecha_inicio, p.fecha_compromiso, p.fecha_fin,
                  p.responsable_id, p.notas,
                  COALESCE(vep.pct_avance, 0) AS pct_avance,
                  COALESCE(vep.alerta, 'AL_DIA') AS alerta,
                  per.nombre AS responsable
           FROM proyectos p
           LEFT JOIN vista_estado_proyectos vep ON vep.proyecto_id = p.id
           LEFT JOIN personas per ON per.id = p.responsable_id
           {where_sql}
           ORDER BY p.prioridad ASC, p.fecha_compromiso ASC NULLS LAST, p.nombre ASC""",
        values,
    )


async def guardar_proyecto(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    data = _normalize_input(payload)
    proyecto_id = _int_or_none(payload.get("id"), "id")

    if not data["nombre"] or not data["cliente"] or not data["fecha_compromiso"]:
        raise AppError(
            "Nombre, cliente y fecha compromiso son obligatorios.",
            400,
            "VALIDATION",
        )

    async with db.begin():
        if proyecto_id:
            rows = await execute(
                db,
                """UPDATE proyectos
                   SET nombre = $1,
                       cliente = $2,
                       fecha_inicio = $3,
                       fecha_compromiso = $4,
                       fecha_fin = $5,
                       prioridad = $6,
                       responsable_id = $7,
                       estado = $8,
                       notas = $9
                   WHERE id = $10
                   RETURNING id""",
                [
                    data["nombre"],
                    data["cliente"],
                    data["fecha_inicio"],
                    data["fecha_compromiso"],
                    data["fecha_fin"],
                    data["prioridad"],
                    data["responsable_id"],
                    data["estado"],
                    data["notas"],
                    proyecto_id,
                ],
            )

            if not rows:
                raise AppError("Proyecto no encontrado.", 404, "NOT_FOUND")

            return {"id": rows[0]["id"], "creado": False}

        insert_rows = await execute(
            db,
            """INSERT INTO proyectos (
                nombre, cliente, fecha_inicio, fecha_compromiso,
                fecha_fin, prioridad, responsable_id, estado, notas
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id""",
            [
                data["nombre"],
                data["cliente"],
                data["fecha_inicio"],
                data["fecha_compromiso"],
                data["fecha_fin"],
                data["prioridad"],
                data["responsable_id"],
                data["estado"],
                data["notas"],
            ],
        )

        proyecto_id = insert_rows[0]["id"]

        await execute(
            db,
            """INSERT INTO proyecto_etapas (proyecto_id, etapa_id, estado)
               SELECT $1, ec.id, 'pendiente'
               FROM etapas_catalogo ec
               ORDER BY ec.orden""",
            [proyecto_id],
        )

    return {"id": proyecto_id, "creado": True}


async def archivar_proyecto(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}

    async with db.begin():
        rows = await execute(
            db,
            """UPDATE proyectos
               SET estado = 'finalizado',
                   fecha_fin = COALESCE(fecha_fin, CURRENT_DATE)
               WHERE id = $1
               RETURNING id""",
            [payload.get("id")],
        )

    if not rows:
        raise AppError("Proyecto no encontrado.", 404, "NOT_FOUND")

    return {"ok": True}


async def obtener_proyecto_detalle(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    proyecto_id = payload.get("id")

    proyecto = await fetch_one(
        db,
        """SELECT p.id, p.nombre, p.cliente, p.fecha_inicio, p.fecha_compromiso,
                  p.fecha_fin, p.prioridad, p.responsable_id, p.estado, p.notas,
                  COALESCE(vep.pct_avance, 0) AS pct_avance,
                  COALESCE(vep.alerta, 'AL_DIA') AS alerta
           FROM proyectos p
           LEFT JOIN vista_estado_proyectos vep ON vep.proyecto_id = p.id
           WHERE p.id = $1""",
        [proyecto_id],
    )

    if not proyecto:
        raise AppError("Proyecto no encontrado.", 404, "NOT_FOUND")

    etapas = await fetch_all(
        db,
        """SELECT pe.id, pe.proyecto_id, pe.etapa_id,
                  ec.nombre AS etapa, ec.orden,
                  pe.fecha_programada, pe.fecha_real,
                  pe.responsable_id, per.nombre AS responsable,
                  pe.estado, pe.motivo_bloqueo, pe.notas
           FROM proyecto_etapas pe
           JOIN etapas_catalogo ec ON ec.id = pe.etapa_id
           LEFT JOIN personas per ON per.id = pe.responsable_id
           WHERE pe.proyecto_id = $1
           ORDER BY ec.orden ASC""",
        [proyecto_id],
    )

    lotes = await fetch_all(
        db,
        """SELECT l.id, l.nombre, l.material_ref, l.estado,
                  l.proceso_actual_id, pr.nombre AS proceso_actual,
                  l.fecha_entrega_prog, l.prioridad
           FROM lotes l
           LEFT JOIN procesos pr ON pr.id = l.proceso_actual_id
           WHERE l.proyecto_id = $1
           ORDER BY l.prioridad ASC, l.fecha_entrega_prog ASC NULLS LAST""",
        [proyecto_id],
    )

    return {
        "proyecto": proyecto,
        "etapas": etapas,
        "lotes": lotes,
    }


async def actualizar_etapa_proyecto(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    etapa_id = payload.get("id")

    if not etapa_id:
        raise AppError(
            "Falta el identificador de la etapa del proyecto.",
            400,
            "VALIDATION",
        )

    async with db.begin():
        rows = await execute(
            db,
            """UPDATE proyecto_etapas
               SET estado = COALESCE($1, estado),
                   fecha_programada = $2,
                   fecha_real = $3,
                   responsable_id = $4,
                   motivo_bloqueo = CASE WHEN COALESCE($1, estado) = 'bloqueado' THEN $5 ELSE NULL END,
                   notas = $6
               WHERE id = $7
               RETURNING id""",
            [
                clean(payload.get("estado")),
                clean(payload.get("fecha_programada")),
                clean(payload.get("fecha_real")),
                clean(payload.get("responsable_id")),
                clean(payload.get("motivo_bloqueo")),
                clean(payload.get("notas")),
                etapa_id,
            ],
        )

    if not rows:
        raise AppError("Etapa de proyecto no encontrada.", 404, "NOT_FOUND")

    return {"ok": True}
