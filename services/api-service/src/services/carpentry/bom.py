from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging_config import get_logger
from src.services.carpentry.common import AppError, clean, decimal_or_none, execute, fetch_all, fetch_one, to_bool

logger = get_logger(__name__)


def _unidad_por_categoria(categoria: str | None) -> str:
    if categoria == "tablero":
        return "m2"
    if categoria == "canto":
        return "ml"
    if categoria == "herraje":
        return "unidad"
    return "unidad"


def _norm(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _calibre_con_mm(value):
    calibre = clean(value)
    if not calibre:
        return None
    without_mm = str(calibre).replace("mm", "").replace("MM", "").strip()
    return f"{without_mm} mm" if without_mm else None


def _int_or_none(value, field_name: str) -> int | None:
    value = clean(value)
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise AppError(f"Valor inválido para {field_name}.", 400, "VALIDATION") from exc


def _int_or_zero(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _date_or_none(value, field_name: str) -> date | None:
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
        raise AppError(f"Fecha inválida en {field_name}.", 400, "VALIDATION") from exc


def _nombre_canonico_por_categoria(data: dict) -> str | None:
    categoria = data.get("categoria")

    if categoria == "tablero":
        material = clean(data.get("material")) or clean(data.get("nombre"))
        calibre = _calibre_con_mm(data.get("calibre"))
        if not material:
            return None
        return f"{material} - {calibre}" if calibre else material

    if categoria == "canto":
        sustrato = clean(data.get("sustrato")) or clean(data.get("nombre"))
        calibre = _calibre_con_mm(data.get("calibre"))
        proveedor = clean(data.get("proveedor"))
        if not sustrato:
            return None
        base = f"{sustrato} - {calibre}" if calibre else sustrato
        return f"{base} | {proveedor}" if proveedor else base

    if categoria == "herraje":
        return clean(data.get("referencia")) or clean(data.get("nombre"))

    return clean(data.get("nombre"))


async def _find_material_id_by_variant(db: AsyncSession, data: dict) -> int | None:
    categoria = data.get("categoria")

    if categoria == "tablero":
        row = await fetch_one(
            db,
            """SELECT mc.id
               FROM materiales_catalogo mc
               JOIN materiales_tableros mt ON mt.material_id = mc.id
               WHERE mc.categoria = 'tablero'
                 AND LOWER(COALESCE(mt.material, '')) = LOWER(COALESCE($1, ''))
                 AND LOWER(COALESCE(mt.sustrato, '')) = LOWER(COALESCE($2, ''))
                 AND LOWER(COALESCE(mt.formato, '')) = LOWER(COALESCE($3, ''))
                 AND LOWER(COALESCE(mt.calibre, '')) = LOWER(COALESCE($4, ''))
                 AND LOWER(COALESCE(mt.proveedor, '')) = LOWER(COALESCE($5, ''))
               ORDER BY mc.id ASC
               LIMIT 1""",
            [
                _norm(data.get("material")) or _norm(data.get("nombre")),
                _norm(data.get("sustrato")),
                _norm(data.get("formato")),
                _norm(data.get("calibre")),
                _norm(data.get("proveedor")),
            ],
        )
        return row["id"] if row else None

    if categoria == "canto":
        row = await fetch_one(
            db,
            """SELECT mc.id
               FROM materiales_catalogo mc
               JOIN materiales_cantos mca ON mca.material_id = mc.id
               WHERE mc.categoria = 'canto'
                 AND LOWER(COALESCE(mca.sustrato, '')) = LOWER(COALESCE($1, ''))
                 AND LOWER(COALESCE(mca.calibre, '')) = LOWER(COALESCE($2, ''))
                 AND LOWER(COALESCE(mca.proveedor, '')) = LOWER(COALESCE($3, ''))
               ORDER BY mc.id ASC
               LIMIT 1""",
            [
                _norm(data.get("sustrato")) or _norm(data.get("nombre")),
                _norm(data.get("calibre")),
                _norm(data.get("proveedor")),
            ],
        )
        return row["id"] if row else None

    if categoria == "herraje":
        row = await fetch_one(
            db,
            """SELECT mc.id
               FROM materiales_catalogo mc
               JOIN materiales_herrajes mh ON mh.material_id = mc.id
               WHERE mc.categoria = 'herraje'
                 AND LOWER(COALESCE(mh.referencia, '')) = LOWER(COALESCE($1, ''))
                 AND LOWER(COALESCE(mh.proveedor, '')) = LOWER(COALESCE($2, ''))
               ORDER BY mc.id ASC
               LIMIT 1""",
            [
                _norm(data.get("referencia")) or _norm(data.get("nombre")),
                _norm(data.get("proveedor")),
            ],
        )
        return row["id"] if row else None

    return None


async def listar_items_por_proyecto(db: AsyncSession, payload: dict | None = None) -> list[dict]:
    payload = payload or {}
    proyecto_id = _int_or_none(payload.get("proyecto_id"), "proyecto_id")

    if not proyecto_id:
        return []

    return await fetch_all(
        db,
        """SELECT ip.id, ip.proyecto_id, ip.lote_id,
                  l.nombre AS lote,
                  ip.nombre, ip.piso, ip.apartamento, ip.estado
           FROM items_proyecto ip
           LEFT JOIN lotes l ON l.id = ip.lote_id
           WHERE ip.proyecto_id = $1
           ORDER BY ip.nombre ASC, ip.piso ASC NULLS LAST, ip.id ASC""",
        [proyecto_id],
    )


async def crear_item(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    piso_raw = clean(payload.get("piso"))
    try:
        piso = int(piso_raw) if piso_raw is not None else None
    except (TypeError, ValueError) as exc:
        raise AppError("Valor inválido para piso.", 400, "VALIDATION") from exc

    data = {
        "proyecto_id": _int_or_none(payload.get("proyecto_id"), "proyecto_id"),
        "nombre": clean(payload.get("nombre")),
        "piso": piso,
        "apartamento": clean(payload.get("apartamento")),
    }

    if not data["proyecto_id"] or not data["nombre"]:
        raise AppError("Proyecto y nombre del ítem son obligatorios.", 400, "VALIDATION")

    async with db.begin():
        rows = await execute(
            db,
            """INSERT INTO items_proyecto (proyecto_id, nombre, piso, apartamento)
               VALUES ($1, $2, $3, $4)
               RETURNING id""",
            [data["proyecto_id"], data["nombre"], data["piso"], data["apartamento"]],
        )

    return {"id": rows[0]["id"], "creado": True}


async def actualizar_item(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    piso_raw = clean(payload.get("piso"))
    try:
        piso = int(piso_raw) if piso_raw is not None else None
    except (TypeError, ValueError) as exc:
        raise AppError("Valor inválido para piso.", 400, "VALIDATION") from exc

    data = {
        "id": _int_or_none(payload.get("id"), "id"),
        "nombre": clean(payload.get("nombre")),
        "piso": piso,
        "apartamento": clean(payload.get("apartamento")),
    }

    if not data["id"] or not data["nombre"]:
        raise AppError("ID y nombre del ítem son obligatorios.", 400, "VALIDATION")

    async with db.begin():
        rows = await execute(
            db,
            """UPDATE items_proyecto
               SET nombre = $1,
                   piso = $2,
                   apartamento = $3
               WHERE id = $4
               RETURNING id""",
            [data["nombre"], data["piso"], data["apartamento"], data["id"]],
        )

    if not rows:
        raise AppError("Ítem no encontrado.", 404, "NOT_FOUND")

    return {"id": rows[0]["id"], "creado": False}


async def eliminar_item(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    item_id = _int_or_none(payload.get("id"), "id")

    if not item_id:
        raise AppError("ID del ítem es obligatorio.", 400, "VALIDATION")

    async with db.begin():
        bom_check = await fetch_one(
            db,
            """SELECT COUNT(*)::INTEGER AS total
               FROM bom_items
               WHERE item_id = $1""",
            [item_id],
        )

        if bom_check and bom_check["total"] > 0:
            raise AppError(
                "No se puede eliminar el ítem porque tiene materiales BOM asociados. Elimina el BOM primero.",
                400,
                "HAS_BOM",
            )

        await execute(db, "DELETE FROM items_proyecto WHERE id = $1", [item_id])

    return {"ok": True}


async def asignar_lote(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    item_id = _int_or_none(payload.get("id"), "id")
    lote_id = _int_or_none(payload.get("lote_id"), "lote_id")

    if not item_id or not lote_id:
        raise AppError("ID del ítem y del lote son obligatorios.", 400, "VALIDATION")

    async with db.begin():
        rows = await execute(
            db,
            """UPDATE items_proyecto
               SET lote_id = $1,
                   estado = 'en_lote'
               WHERE id = $2
               RETURNING id""",
            [lote_id, item_id],
        )

    if not rows:
        raise AppError("Ítem no encontrado.", 404, "NOT_FOUND")

    return {"ok": True}


async def desasignar_lote(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    item_id = _int_or_none(payload.get("id"), "id")

    if not item_id:
        raise AppError("ID del ítem es obligatorio.", 400, "VALIDATION")

    async with db.begin():
        rows = await execute(
            db,
            """UPDATE items_proyecto
               SET lote_id = NULL,
                   estado = 'pendiente'
               WHERE id = $1
               RETURNING id""",
            [item_id],
        )

    if not rows:
        raise AppError("Ítem no encontrado.", 404, "NOT_FOUND")

    return {"ok": True}


async def copiar_bom_a_items(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    item_origen_id = _int_or_none(payload.get("item_origen_id"), "item_origen_id")
    raw_destinos = payload.get("item_destinos_ids")
    item_destinos_ids: list[int] = []
    if isinstance(raw_destinos, list):
        for item in raw_destinos:
            parsed = _int_or_none(item, "item_destinos_ids")
            if parsed is not None:
                item_destinos_ids.append(parsed)

    if not item_origen_id or not isinstance(item_destinos_ids, list) or not item_destinos_ids:
        raise AppError(
            "item_origen_id y al menos un item_destinos_ids son obligatorios.",
            400,
            "VALIDATION",
        )

    async with db.begin():
        bom_origen = await fetch_all(
            db,
            """SELECT material_id, cantidad_requerida, notas
               FROM bom_items
               WHERE item_id = $1""",
            [item_origen_id],
        )

        if not bom_origen:
            raise AppError("El ítem origen no tiene materiales BOM para copiar.", 400, "EMPTY_BOM")

        item_ids = []
        material_ids = []
        cantidades = []
        notas = []

        for destino_id in item_destinos_ids:
            for row in bom_origen:
                item_ids.append(destino_id)
                material_ids.append(row["material_id"])
                cantidades.append(row["cantidad_requerida"])
                notas.append(row["notas"])

        await execute(
            db,
            """INSERT INTO bom_items (item_id, material_id, cantidad_requerida, notas)
               SELECT *
               FROM unnest(
                 $1::INT[],
                 $2::INT[],
                 $3::NUMERIC[],
                 $4::TEXT[]
               ) AS src(item_id, material_id, cantidad_requerida, notas)
               ON CONFLICT (item_id, material_id)
               DO UPDATE SET cantidad_requerida = EXCLUDED.cantidad_requerida,
                             notas = EXCLUDED.notas""",
            [item_ids, material_ids, cantidades, notas],
        )

    return {"ok": True, "copiados": len(item_destinos_ids)}


async def listar_bom_por_item(db: AsyncSession, payload: dict | None = None) -> list[dict]:
    payload = payload or {}
    item_id = _int_or_none(payload.get("item_id"), "item_id")
    if not item_id:
        return []

    return await fetch_all(
        db,
        """SELECT bi.id, bi.item_id, bi.material_id,
                  mc.nombre AS material, mc.categoria, mc.unidad_medida,
                  bi.cantidad_requerida, bi.notas
           FROM bom_items bi
           JOIN materiales_catalogo mc ON mc.id = bi.material_id
           WHERE bi.item_id = $1
           ORDER BY mc.nombre""",
        [item_id],
    )


async def guardar_material_bom(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    data = {
        "item_id": _int_or_none(payload.get("item_id"), "item_id"),
        "material_id": _int_or_none(payload.get("material_id"), "material_id"),
        "cantidad_requerida": decimal_or_none(payload.get("cantidad_requerida")),
        "notas": clean(payload.get("notas")),
    }

    if not data["item_id"] or not data["material_id"] or not data["cantidad_requerida"] or data["cantidad_requerida"] <= 0:
        raise AppError(
            "Item, material y cantidad requerida (>0) son obligatorios.",
            400,
            "VALIDATION",
        )

    async with db.begin():
        rows = await execute(
            db,
            """INSERT INTO bom_items (item_id, material_id, cantidad_requerida, notas)
               VALUES ($1,$2,$3,$4)
               ON CONFLICT (item_id, material_id)
               DO UPDATE SET cantidad_requerida = EXCLUDED.cantidad_requerida,
                             notas = EXCLUDED.notas
               RETURNING id""",
            [
                data["item_id"],
                data["material_id"],
                data["cantidad_requerida"],
                data["notas"],
            ],
        )

    return {"id": rows[0]["id"]}


async def eliminar_material_bom(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    bom_id = _int_or_none(payload.get("id"), "id")
    if not bom_id:
        raise AppError("ID del BOM es obligatorio.", 400, "VALIDATION")
    async with db.begin():
        await execute(db, "DELETE FROM bom_items WHERE id = $1", [bom_id])
    return {"ok": True}


async def listar_materiales(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    params = []
    clauses = []

    if filters.get("categoria"):
        params.append(filters["categoria"])
        clauses.append(f"mc.categoria = ${len(params)}")

    if filters.get("activo") not in (None, ""):
        params.append(to_bool(filters["activo"]))
        clauses.append(f"mc.activo = ${len(params)}")

    if filters.get("q"):
        params.append(f"%{filters['q']}%")
        q_param = f"${len(params)}"
        clauses.append(
            "(" +
            f"mc.nombre ILIKE {q_param} OR mt.material ILIKE {q_param} OR mt.sustrato ILIKE {q_param} OR "
            f"mt.formato ILIKE {q_param} OR mt.calibre ILIKE {q_param} OR mt.proveedor ILIKE {q_param} OR "
            f"mca.sustrato ILIKE {q_param} OR mca.calibre ILIKE {q_param} OR mca.proveedor ILIKE {q_param} OR "
            f"mh.referencia ILIKE {q_param} OR mh.proveedor ILIKE {q_param}" +
            ")"
        )

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    return await fetch_all(
        db,
        f"""SELECT mc.id, mc.nombre, mc.categoria, mc.unidad_medida,
                  mc.descripcion, mc.activo,
                  mt.material, mt.sustrato AS tablero_sustrato,
                  mt.formato AS tablero_formato, mt.calibre AS tablero_calibre,
                  mt.costo AS tablero_costo, mt.proveedor AS tablero_proveedor,
                  mca.sustrato AS canto_sustrato, mca.proveedor AS canto_proveedor,
                  mca.calibre AS canto_calibre, mca.costo AS canto_costo,
                  mh.referencia AS herraje_referencia, mh.proveedor AS herraje_proveedor,
                  mh.costo AS herraje_costo,
                  COUNT(bi.id)::INTEGER AS referencias_bom
           FROM materiales_catalogo mc
           LEFT JOIN materiales_tableros mt ON mt.material_id = mc.id
           LEFT JOIN materiales_cantos mca ON mca.material_id = mc.id
           LEFT JOIN materiales_herrajes mh ON mh.material_id = mc.id
           LEFT JOIN bom_items bi ON bi.material_id = mc.id
           {where_sql}
           GROUP BY mc.id, mt.material, mt.sustrato, mt.formato, mt.calibre, mt.costo, mt.proveedor,
                    mca.sustrato, mca.proveedor, mca.calibre, mca.costo,
                    mh.referencia, mh.proveedor, mh.costo
           ORDER BY mc.categoria ASC, mc.nombre ASC, mc.id ASC""",
        params,
    )


async def guardar_material(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    data = {
        "id": _int_or_none(payload.get("id"), "id"),
        "nombre": clean(payload.get("nombre")),
        "categoria": clean(payload.get("categoria")),
        "unidad_medida": clean(payload.get("unidad_medida")),
        "descripcion": clean(payload.get("descripcion")),
        "activo": True if payload.get("activo") is None else bool(payload.get("activo")),
        "material": clean(payload.get("material")),
        "sustrato": clean(payload.get("sustrato")),
        "formato": clean(payload.get("formato")),
        "calibre": clean(payload.get("calibre")),
        "costo": decimal_or_none(payload.get("costo")),
        "proveedor": clean(payload.get("proveedor")),
        "referencia": clean(payload.get("referencia")),
    }

    nombre_canonico = _nombre_canonico_por_categoria(data)
    unidad = data["unidad_medida"] or _unidad_por_categoria(data["categoria"])

    if not nombre_canonico or not data["categoria"] or not unidad:
        raise AppError(
            "Nombre/material base, categoría y unidad son obligatorios.",
            400,
            "VALIDATION",
        )

    async with db.begin():
        material_id = data["id"]
        creado = False

        if material_id:
            rows = await execute(
                db,
                """UPDATE materiales_catalogo
                   SET nombre = $1,
                       categoria = $2,
                       unidad_medida = $3,
                       descripcion = $4,
                       activo = $5
                   WHERE id = $6
                   RETURNING id""",
                [
                    nombre_canonico,
                    data["categoria"],
                    unidad,
                    data["descripcion"],
                    data["activo"],
                    material_id,
                ],
            )
            if not rows:
                raise AppError("Material no encontrado.", 404, "NOT_FOUND")
            material_id = rows[0]["id"]
        else:
            material_id = await _find_material_id_by_variant(db, data)

        if material_id and not data["id"]:
            rows = await execute(
                db,
                """UPDATE materiales_catalogo
                   SET nombre = $1,
                       categoria = $2,
                       unidad_medida = $3,
                       descripcion = $4,
                       activo = $5
                   WHERE id = $6
                   RETURNING id""",
                [
                    nombre_canonico,
                    data["categoria"],
                    unidad,
                    data["descripcion"],
                    data["activo"],
                    material_id,
                ],
            )
            if not rows:
                raise AppError("Material no encontrado.", 404, "NOT_FOUND")
        elif not material_id:
            rows = await execute(
                db,
                """INSERT INTO materiales_catalogo (nombre, categoria, unidad_medida, descripcion, activo)
                   VALUES ($1,$2,$3,$4,$5)
                   RETURNING id""",
                [nombre_canonico, data["categoria"], unidad, data["descripcion"], data["activo"]],
            )
            material_id = rows[0]["id"]
            creado = True

        await execute(db, "DELETE FROM materiales_tableros WHERE material_id = $1", [material_id])
        await execute(db, "DELETE FROM materiales_cantos WHERE material_id = $1", [material_id])
        await execute(db, "DELETE FROM materiales_herrajes WHERE material_id = $1", [material_id])

        if data["categoria"] == "tablero":
            await execute(
                db,
                """INSERT INTO materiales_tableros (
                    material_id, material, sustrato, formato, calibre, costo, proveedor
                ) VALUES ($1,$2,$3,$4,$5,$6,$7)""",
                [
                    material_id,
                    data["material"] or nombre_canonico,
                    data["sustrato"],
                    data["formato"],
                    data["calibre"],
                    data["costo"],
                    data["proveedor"],
                ],
            )

        if data["categoria"] == "canto":
            await execute(
                db,
                """INSERT INTO materiales_cantos (
                    material_id, sustrato, proveedor, calibre, costo
                ) VALUES ($1,$2,$3,$4,$5)""",
                [
                    material_id,
                    data["sustrato"] or data["nombre"] or nombre_canonico,
                    data["proveedor"],
                    data["calibre"],
                    data["costo"],
                ],
            )

        if data["categoria"] == "herraje":
            await execute(
                db,
                """INSERT INTO materiales_herrajes (
                    material_id, referencia, proveedor, costo
                ) VALUES ($1,$2,$3,$4)""",
                [
                    material_id,
                    data["referencia"] or data["nombre"] or nombre_canonico,
                    data["proveedor"],
                    data["costo"],
                ],
            )

    return {"id": material_id, "creado": creado}


async def desactivar_material(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    material_id = _int_or_none(payload.get("id"), "id")
    if not material_id:
        raise AppError("ID del material es obligatorio.", 400, "VALIDATION")

    async with db.begin():
        rows = await execute(
            db,
            """UPDATE materiales_catalogo
               SET activo = FALSE
               WHERE id = $1
               RETURNING id""",
            [material_id],
        )

    if not rows:
        raise AppError("Material no encontrado.", 404, "NOT_FOUND")

    return {"ok": True}


async def crear_items_bulk(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    proyecto_id = _int_or_none(payload.get("proyecto_id"), "proyecto_id")
    nombre = payload.get("nombre")
    cantidad = payload.get("cantidad")

    if not proyecto_id or not nombre:
        raise AppError("Proyecto y nombre son obligatorios.", 400, "VALIDATION")

    n = _int_or_zero(cantidad)

    if n < 1 or n > 500:
        raise AppError("La cantidad debe ser un número entre 1 y 500.", 400, "VALIDATION")

    async with db.begin():
        rows = await execute(
            db,
            """INSERT INTO items_proyecto (proyecto_id, nombre)
               SELECT $1, $2
               FROM generate_series(1, $3)
               RETURNING id""",
            [proyecto_id, nombre, n],
        )

    return {"creados": len(rows), "ids": [row["id"] for row in rows]}
