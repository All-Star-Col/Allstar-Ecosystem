from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging_config import get_logger
from src.services.carpentry.common import AppError, clean, execute, fetch_all, fetch_one, int_or_none

logger = get_logger(__name__)


_CACHE: dict[str, dict] = {}
CACHE_TTL_SECONDS = 5 * 60


def _cache_key(name: str) -> str:
    return f"catalogos:{name}"


def _get_cached(name: str):
    import time

    key = _cache_key(name)
    entry = _CACHE.get(key)
    if not entry:
        return None
    if entry["expires_at"] <= time.time():
        _CACHE.pop(key, None)
        return None
    return entry["value"]


def _set_cached(name: str, value):
    import time

    _CACHE[_cache_key(name)] = {
        "value": value,
        "expires_at": time.time() + CACHE_TTL_SECONDS,
    }


def _invalidate(*names: str):
    for name in names:
        _CACHE.pop(_cache_key(name), None)


async def _cached_query(name: str, query_fn):
    cached = _get_cached(name)
    if cached is not None:
        logger.debug("Catalogo carpinteria en cache | nombre=%s", name)
        return cached

    logger.debug("Catalogo carpinteria sin cache | nombre=%s", name)
    rows = await query_fn()
    _set_cached(name, rows)
    return rows


async def listar_procesos(db: AsyncSession, _payload: dict | None = None) -> list[dict]:
    async def _query():
        return await fetch_all(
            db,
            """SELECT id, nombre, orden_linea, capacidad_horas_dia
               FROM procesos
               ORDER BY orden_linea ASC NULLS LAST, id ASC""",
        )

    return await _cached_query("procesos", _query)


async def listar_etapas_catalogo(db: AsyncSession, _payload: dict | None = None) -> list[dict]:
    async def _query():
        return await fetch_all(
            db,
            """SELECT id, nombre, orden, descripcion
               FROM etapas_catalogo
               ORDER BY orden ASC""",
        )

    return await _cached_query("etapas_catalogo", _query)


async def listar_areas(db: AsyncSession, _payload: dict | None = None) -> list[dict]:
    async def _query():
        return await fetch_all(
            db,
            """SELECT a.id, a.nombre,
                      COUNT(p.id)::INTEGER AS total_personas
               FROM areas a
               LEFT JOIN personas p ON p.area_id = a.id
               GROUP BY a.id
               ORDER BY a.nombre ASC""",
        )

    return await _cached_query("areas", _query)


async def guardar_area(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    area_id = int_or_none(payload.get("id"))
    nombre = clean(payload.get("nombre"))

    if not nombre:
        raise AppError("El nombre del área es obligatorio.", 400, "VALIDATION")

    async with db.begin():
        if area_id:
            rows = await execute(
                db,
                """UPDATE areas
                   SET nombre = $1
                   WHERE id = $2
                   RETURNING id""",
                [nombre, area_id],
            )
            if not rows:
                raise AppError("Área no encontrada.", 404, "NOT_FOUND")

            _invalidate("areas")
            return {"id": rows[0]["id"], "creado": False}

        rows = await execute(
            db,
            """INSERT INTO areas (nombre)
               VALUES ($1)
               RETURNING id""",
            [nombre],
        )

    _invalidate("areas")
    return {"id": rows[0]["id"], "creado": True}


async def eliminar_area(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    area_id = int_or_none(payload.get("id"))

    uso = await fetch_one(
        db,
        """SELECT COUNT(*)::INTEGER AS total
           FROM personas
           WHERE area_id = $1""",
        [area_id],
    )

    if uso and uso["total"] > 0:
        raise AppError(
            "No se puede eliminar un área en uso por personas.",
            400,
            "AREA_IN_USE",
        )

    async with db.begin():
        rows = await execute(
            db,
            """DELETE FROM areas
               WHERE id = $1
               RETURNING id""",
            [area_id],
        )

    if not rows:
        raise AppError("Área no encontrada.", 404, "NOT_FOUND")

    _invalidate("areas")
    return {"ok": True}


async def listar_personas_activas(db: AsyncSession, _payload: dict | None = None) -> list[dict]:
    return await fetch_all(
        db,
        """SELECT p.id, p.nombre, p.proceso_id, p.area_id,
                  a.nombre AS area,
                  p.horas_dia_disponibles
           FROM personas p
           LEFT JOIN areas a ON a.id = p.area_id
           WHERE p.activo = TRUE
           ORDER BY p.nombre ASC""",
    )


async def listar_maquinas_activas(db: AsyncSession, _payload: dict | None = None) -> list[dict]:
    return await fetch_all(
        db,
        """SELECT id, nombre, proceso_id, horas_dia_disponibles
           FROM maquinas
           WHERE activo = TRUE
           ORDER BY nombre ASC""",
    )


async def listar_proyectos_activos(db: AsyncSession, _payload: dict | None = None) -> list[dict]:
    return await fetch_all(
        db,
        """SELECT id, nombre, cliente, estado, fecha_compromiso
           FROM proyectos
           WHERE estado <> 'finalizado'
           ORDER BY prioridad ASC, fecha_compromiso ASC NULLS LAST, nombre ASC""",
    )


async def listar_lotes_activos(db: AsyncSession, _payload: dict | None = None) -> list[dict]:
    return await fetch_all(
        db,
        """SELECT l.id, l.nombre, l.estado, l.proceso_actual_id, p.nombre AS proyecto
           FROM lotes l
           JOIN proyectos p ON p.id = l.proyecto_id
           WHERE l.estado IN ('pendiente','en_produccion','empacado','instalacion','despachado','bloqueado')
           ORDER BY l.prioridad ASC, l.fecha_entrega_prog ASC NULLS LAST, l.nombre ASC""",
    )
