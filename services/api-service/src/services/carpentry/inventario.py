from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging_config import get_logger
from src.services.carpentry.common import (
    AppError,
    clean,
    execute,
    fetch_all,
    int_or_none,
    decimal_or_none,
    date_or_none,
)

logger = get_logger(__name__)


async def listar_stock(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    umbral = int(filters.get("umbral") or 10)
    params = [umbral]
    clauses = ["i.cantidad_disponible > 0"]

    if filters.get("categoria"):
        params.append(filters["categoria"])
        clauses.append(f"mc.categoria = ${len(params)}")

    if filters.get("solo_bajo") is True or filters.get("solo_bajo") == "true":
        clauses.append("COALESCE(i.cantidad_disponible, 0) < $1")

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    return await fetch_all(
        db,
        f"""SELECT mc.id AS material_id,
                  mc.nombre AS material,
                  mc.categoria,
                  mc.unidad_medida,
                  COALESCE(i.cantidad_disponible, 0) AS cantidad_disponible,
                  i.ultima_actualizacion,
                  CASE
                    WHEN COALESCE(i.cantidad_disponible, 0) < $1 THEN 'amarillo'
                    ELSE 'verde'
                  END AS semaforo
           FROM inventario i
           JOIN materiales_catalogo mc ON mc.id = i.material_id
           {where_sql}
           ORDER BY mc.categoria, mc.nombre""",
        params,
    )


async def registrar_movimiento(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}

    data = {
        "material_id": int_or_none(payload.get("material_id")),
        "tipo": clean(payload.get("tipo")),
        "cantidad": decimal_or_none(payload.get("cantidad")),
        "lote_id": int_or_none(payload.get("lote_id")),
        "item_id": int_or_none(payload.get("item_id")),
        "proyecto_id": int_or_none(payload.get("proyecto_id")),
        "fecha": date_or_none(payload.get("fecha")),
        "referencia": clean(payload.get("referencia")),
        "responsable_id": int_or_none(payload.get("responsable_id")),
        "notas": clean(payload.get("notas")),
    }

    if not data["material_id"] or not data["tipo"] or data["cantidad"] is None or data["cantidad"] <= 0:
        raise AppError("Material, tipo y cantidad (>0) son obligatorios.", 400, "VALIDATION")

    if data["tipo"] == "ajuste" and not data["notas"]:
        raise AppError(
            "El ajuste de inventario requiere una nota obligatoria.",
            400,
            "VALIDATION",
        )

    async with db.begin():
        rows = await execute(
            db,
            """INSERT INTO movimientos_inventario (
                 material_id, tipo, cantidad, lote_id, item_id, proyecto_id,
                 fecha, referencia, responsable_id, notas
               ) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, CURRENT_DATE),$8,$9,$10)
               RETURNING id""",
            [
                data["material_id"],
                data["tipo"],
                data["cantidad"],
                data["lote_id"],
                data["item_id"],
                data["proyecto_id"],
                data["fecha"],
                data["referencia"],
                data["responsable_id"],
                data["notas"],
            ],
        )

    return {"id": rows[0]["id"]}


async def listar_movimientos(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    params = []
    clauses = []

    if filters.get("material_id"):
        params.append(filters["material_id"])
        clauses.append(f"m.material_id = ${len(params)}")
    if filters.get("tipo"):
        params.append(filters["tipo"])
        clauses.append(f"m.tipo = ${len(params)}")
    if filters.get("proyecto_id"):
        params.append(filters["proyecto_id"])
        clauses.append(f"m.proyecto_id = ${len(params)}")
    if filters.get("lote_id"):
        params.append(filters["lote_id"])
        clauses.append(f"m.lote_id = ${len(params)}")
    if filters.get("desde"):
        params.append(filters["desde"])
        clauses.append(f"m.fecha >= ${len(params)}")
    if filters.get("hasta"):
        params.append(filters["hasta"])
        clauses.append(f"m.fecha <= ${len(params)}")

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    return await fetch_all(
        db,
        f"""SELECT m.id, m.material_id, mc.nombre AS material, mc.categoria,
                  m.tipo, m.cantidad, m.lote_id, l.nombre AS lote,
                  m.proyecto_id, p.nombre AS proyecto, m.item_id,
                  m.fecha, m.referencia, m.responsable_id,
                  per.nombre AS responsable, m.notas, m.created_at
           FROM movimientos_inventario m
           JOIN materiales_catalogo mc ON mc.id = m.material_id
           LEFT JOIN lotes l ON l.id = m.lote_id
           LEFT JOIN proyectos p ON p.id = m.proyecto_id
           LEFT JOIN personas per ON per.id = m.responsable_id
           {where_sql}
           ORDER BY m.fecha DESC, m.created_at DESC""",
        params,
    )


async def listar_necesidades(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    params = []
    clauses = []

    if filters.get("proyecto_id"):
        params.append(filters["proyecto_id"])
        clauses.append(f"vnm.proyecto_id = ${len(params)}")

    if filters.get("lote_id"):
        params.append(filters["lote_id"])
        clauses.append(f"vnm.lote_id = ${len(params)}")

    if filters.get("solo_faltantes") is True or filters.get("solo_faltantes") == "true":
        clauses.append("vnm.material_disponible = FALSE")

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    return await fetch_all(
        db,
        f"""SELECT vnm.proyecto_id, vnm.proyecto, vnm.lote_id, vnm.lote,
                  vnm.material_id, vnm.material, vnm.categoria, vnm.unidad_medida,
                  vnm.cantidad_requerida, vnm.cantidad_en_bodega,
                  vnm.cantidad_pendiente, vnm.material_disponible
           FROM vista_necesidades_materiales vnm
           {where_sql}
           ORDER BY vnm.proyecto, vnm.lote, vnm.material""",
        params,
    )
