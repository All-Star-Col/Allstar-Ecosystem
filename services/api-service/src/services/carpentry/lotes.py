import unicodedata

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging_config import get_logger
from src.services.carpentry.common import AppError, build_where, clean, execute, fetch_all, fetch_one

logger = get_logger(__name__)


def _normalize_text(value: str | None) -> str:
    text = str(value or "").strip().lower()
    normalized = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _requiere_maquina(proceso_nombre: str | None) -> bool:
    name = _normalize_text(proceso_nombre)
    return any(stage in name for stage in ["seccionado", "enchape", "mecanizado", "armado"])


def _es_seccionado(proceso_nombre: str | None) -> bool:
    return "seccionado" in _normalize_text(proceso_nombre)


def _normalize_input(data: dict) -> dict:
    return {
        "proyecto_id": clean(data.get("proyecto_id")),
        "nombre": clean(data.get("nombre")),
        "descripcion": clean(data.get("descripcion")),
        "material_ref": clean(data.get("material_ref")),
        "estado": clean(data.get("estado")) or "pendiente",
        "proceso_actual_id": clean(data.get("proceso_actual_id")),
        "fecha_inicio_prog": clean(data.get("fecha_inicio_prog")),
        "fecha_entrega_prog": clean(data.get("fecha_entrega_prog")),
        "prioridad": int(data.get("prioridad") or 2),
        "notas": clean(data.get("notas")),
    }


async def listar_lotes(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}
    where_sql, values, _ = build_where(
        {
            "estado": filters.get("estado"),
            "proyecto_id": filters.get("proyecto_id"),
            "proceso_actual_id": filters.get("proceso_actual_id"),
        },
        {
            "estado": "l.estado",
            "proyecto_id": "l.proyecto_id",
            "proceso_actual_id": "l.proceso_actual_id",
        },
    )

    return await fetch_all(
        db,
        f"""SELECT l.id, l.nombre, l.proyecto_id, p.nombre AS proyecto,
                  l.material_ref, l.estado, l.proceso_actual_id,
                  pr.nombre AS proceso_actual, l.prioridad,
                  l.fecha_entrega_prog,
                  (l.fecha_entrega_prog - CURRENT_DATE) AS dias_restantes
           FROM lotes l
           JOIN proyectos p ON p.id = l.proyecto_id
           LEFT JOIN procesos pr ON pr.id = l.proceso_actual_id
           {where_sql}
           ORDER BY l.prioridad ASC, l.fecha_entrega_prog ASC NULLS LAST, l.id DESC""",
        values,
    )


async def guardar_lote(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    data = _normalize_input(payload)

    if not data["proyecto_id"] or not data["nombre"]:
        raise AppError("Proyecto y nombre del lote son obligatorios.", 400, "VALIDATION")

    async with db.begin():
        if data["proceso_actual_id"]:
            proceso_valido = await fetch_one(
                db,
                """SELECT id
                   FROM procesos
                   WHERE id = $1
                     AND orden_linea IS NOT NULL
                   LIMIT 1""",
                [data["proceso_actual_id"]],
            )
            if not proceso_valido:
                raise AppError(
                    "El proceso actual debe pertenecer a la línea de ensamblaje.",
                    400,
                    "VALIDATION",
                )

        if payload.get("id"):
            rows = await execute(
                db,
                """UPDATE lotes
                   SET proyecto_id = $1,
                       nombre = $2,
                       descripcion = $3,
                       material_ref = $4,
                       estado = $5,
                       proceso_actual_id = $6,
                       fecha_inicio_prog = $7,
                       fecha_entrega_prog = $8,
                       prioridad = $9,
                       notas = $10
                   WHERE id = $11
                   RETURNING id""",
                [
                    data["proyecto_id"],
                    data["nombre"],
                    data["descripcion"],
                    data["material_ref"],
                    data["estado"],
                    data["proceso_actual_id"],
                    data["fecha_inicio_prog"],
                    data["fecha_entrega_prog"],
                    data["prioridad"],
                    data["notas"],
                    payload["id"],
                ],
            )

            if not rows:
                raise AppError("Lote no encontrado.", 404, "NOT_FOUND")

            return {"id": rows[0]["id"], "creado": False}

        proceso_actual_id = data["proceso_actual_id"]
        if not proceso_actual_id:
            first_process = await fetch_one(
                db,
                """SELECT id
                   FROM procesos
                   WHERE orden_linea IS NOT NULL
                   ORDER BY orden_linea ASC, id ASC
                   LIMIT 1""",
            )
            proceso_actual_id = first_process["id"] if first_process else None

        insert_lote = await execute(
            db,
            """INSERT INTO lotes (
                 proyecto_id, nombre, descripcion, material_ref, estado,
                 proceso_actual_id, fecha_inicio_prog, fecha_entrega_prog,
                 prioridad, notas
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               RETURNING id""",
            [
                data["proyecto_id"],
                data["nombre"],
                data["descripcion"],
                data["material_ref"],
                data["estado"],
                proceso_actual_id,
                data["fecha_inicio_prog"],
                data["fecha_entrega_prog"],
                data["prioridad"],
                data["notas"],
            ],
        )

        lote_id = insert_lote[0]["id"]

        await execute(
            db,
            """INSERT INTO lote_procesos (lote_id, proceso_id, orden, estado)
               SELECT $1,
                      p.id,
                      p.orden_linea::SMALLINT,
                      'pendiente'
               FROM procesos p
               WHERE p.orden_linea IS NOT NULL
               ORDER BY p.orden_linea ASC, p.id ASC""",
            [lote_id],
        )

    return {"id": lote_id, "creado": True}


async def obtener_lote_detalle(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    lote_id = payload.get("id")

    lote = await fetch_one(
        db,
        """SELECT l.id, l.proyecto_id, p.nombre AS proyecto,
                  l.nombre, l.descripcion, l.material_ref, l.estado,
                  l.proceso_actual_id, pr.nombre AS proceso_actual,
                  l.fecha_inicio_prog, l.fecha_inicio_real,
                  l.fecha_entrega_prog, l.fecha_entrega_real,
                  l.prioridad, l.notas
           FROM lotes l
           JOIN proyectos p ON p.id = l.proyecto_id
           LEFT JOIN procesos pr ON pr.id = l.proceso_actual_id
           WHERE l.id = $1""",
        [lote_id],
    )

    if not lote:
        raise AppError("Lote no encontrado.", 404, "NOT_FOUND")

    procesos = await fetch_all(
        db,
        """SELECT lp.id, lp.lote_id, lp.proceso_id, p.nombre AS proceso,
                  lp.orden, lp.fecha_programada, lp.fecha_inicio_real,
                  lp.fecha_fin_real, lp.responsable_id, lp.maquina_id,
                  per.nombre AS responsable, maq.nombre AS maquina,
                  lp.estado, lp.motivo_bloqueo, lp.notas
           FROM lote_procesos lp
           JOIN procesos p ON p.id = lp.proceso_id
           LEFT JOIN personas per ON per.id = lp.responsable_id
           LEFT JOIN maquinas maq ON maq.id = lp.maquina_id
           WHERE lp.lote_id = $1
           ORDER BY lp.orden ASC""",
        [lote_id],
    )

    items = await fetch_all(
        db,
        """SELECT ip.id, ip.proyecto_id, ip.lote_id,
                  ip.nombre, ip.piso, ip.apartamento, ip.estado
           FROM items_proyecto ip
           WHERE ip.lote_id = $1
           ORDER BY ip.nombre ASC, ip.piso ASC NULLS LAST, ip.id ASC""",
        [lote_id],
    )

    necesidades = await fetch_all(
        db,
        """SELECT material, categoria, unidad_medida,
                  cantidad_requerida, cantidad_en_bodega,
                  cantidad_pendiente, material_disponible
           FROM vista_necesidades_materiales
           WHERE lote_id = $1
           ORDER BY categoria, material""",
        [lote_id],
    )

    faltantes = await fetch_one(
        db,
        """SELECT COUNT(*)::INTEGER AS faltantes
           FROM vista_necesidades_materiales
           WHERE lote_id = $1
             AND material_disponible = FALSE""",
        [lote_id],
    )

    return {
        "lote": lote,
        "procesos": procesos,
        "items": items,
        "necesidadesMateriales": necesidades,
        "materialCompleto": (faltantes or {}).get("faltantes", 0) == 0,
    }


async def actualizar_lote_proceso(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    process_row_id = payload.get("id")

    if not process_row_id:
        raise AppError("Falta el identificador del proceso del lote.", 400, "VALIDATION")

    async with db.begin():
        proceso = await fetch_one(
            db,
            """SELECT lp.lote_id, lp.proceso_id, p.nombre AS proceso_nombre
               FROM lote_procesos lp
               JOIN procesos p ON p.id = lp.proceso_id
               WHERE lp.id = $1
               LIMIT 1""",
            [process_row_id],
        )

        if not proceso:
            raise AppError("Proceso del lote no encontrado.", 404, "NOT_FOUND")

        maquina_id = clean(payload.get("maquina_id"))

        if _requiere_maquina(proceso.get("proceso_nombre")) and not maquina_id:
            if _es_seccionado(proceso.get("proceso_nombre")):
                auto_maquina = await fetch_one(
                    db,
                    """SELECT id
                       FROM maquinas
                       WHERE proceso_id = $1
                         AND activo = TRUE
                       ORDER BY id ASC
                       LIMIT 1""",
                    [proceso["proceso_id"]],
                )
                if not auto_maquina:
                    raise AppError(
                        "No hay una máquina activa disponible para Seccionado.",
                        400,
                        "VALIDATION",
                    )
                maquina_id = auto_maquina["id"]
            else:
                raise AppError("Debes seleccionar una máquina para este proceso.", 400, "VALIDATION")

        if maquina_id:
            maquina_valida = await fetch_one(
                db,
                """SELECT id
                   FROM maquinas
                   WHERE id = $1
                     AND proceso_id = $2
                   LIMIT 1""",
                [maquina_id, proceso["proceso_id"]],
            )
            if not maquina_valida:
                raise AppError(
                    "La máquina seleccionada debe pertenecer al mismo proceso del lote.",
                    400,
                    "VALIDATION",
                )

        rows = await execute(
            db,
            """UPDATE lote_procesos
               SET estado = COALESCE($1, estado),
                   responsable_id = $2,
                   maquina_id = $3,
                   fecha_programada = $4,
                   fecha_inicio_real = $5,
                   fecha_fin_real = $6,
                   motivo_bloqueo = CASE WHEN COALESCE($1, estado) = 'bloqueado' THEN $7 ELSE NULL END,
                   notas = $8
               WHERE id = $9
               RETURNING lote_id, proceso_id, estado""",
            [
                clean(payload.get("estado")),
                clean(payload.get("responsable_id")),
                maquina_id,
                clean(payload.get("fecha_programada")),
                clean(payload.get("fecha_inicio_real")),
                clean(payload.get("fecha_fin_real")),
                clean(payload.get("motivo_bloqueo")),
                clean(payload.get("notas")),
                process_row_id,
            ],
        )

        if not rows:
            raise AppError("Proceso del lote no encontrado.", 404, "NOT_FOUND")

        proc = rows[0]

        if proc["estado"] in ["en_proceso", "bloqueado"]:
            await execute(
                db,
                """UPDATE lotes
                   SET proceso_actual_id = $1,
                       fecha_inicio_real = CASE
                         WHEN $2 = 'en_proceso' THEN COALESCE(fecha_inicio_real, CURRENT_DATE)
                         ELSE fecha_inicio_real
                       END,
                       estado = CASE WHEN $2 = 'bloqueado' THEN 'bloqueado' ELSE 'en_produccion' END
                   WHERE id = $3""",
                [proc["proceso_id"], proc["estado"], proc["lote_id"]],
            )

        if proc["estado"] == "completado":
            pendientes = await fetch_one(
                db,
                """SELECT COUNT(*)::INTEGER AS total
                   FROM lote_procesos
                   WHERE lote_id = $1
                     AND estado <> 'completado'""",
                [proc["lote_id"]],
            )

            if pendientes and pendientes["total"] == 0:
                await execute(
                    db,
                    """UPDATE lotes
                       SET estado = 'empacado'
                       WHERE id = $1""",
                    [proc["lote_id"]],
                )

    return {"ok": True}


async def iniciar_lote_proceso(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    lote_id = payload.get("lote_id")

    if not lote_id:
        raise AppError("Debes indicar el lote.", 400, "VALIDATION")

    async with db.begin():
        lote = await fetch_one(
            db,
            """SELECT id, proceso_actual_id, fecha_inicio_real
               FROM lotes
               WHERE id = $1
               LIMIT 1""",
            [lote_id],
        )

        if not lote:
            raise AppError("Lote no encontrado.", 404, "NOT_FOUND")

        if lote["fecha_inicio_real"]:
            return {
                "ok": True,
                "already_started": True,
                "proceso_actual_id": lote["proceso_actual_id"],
            }

        if not lote["proceso_actual_id"]:
            raise AppError(
                "El lote no tiene proceso actual configurado.",
                400,
                "NO_CURRENT_PROCESS",
            )

        proceso_actual = await fetch_one(
            db,
            """SELECT id
               FROM lote_procesos
               WHERE lote_id = $1
                 AND proceso_id = $2
               LIMIT 1""",
            [lote_id, lote["proceso_actual_id"]],
        )

        if not proceso_actual:
            raise AppError(
                "No existe configuración del proceso actual para este lote.",
                400,
                "NO_CURRENT_PROCESS",
            )

        await execute(
            db,
            """UPDATE lote_procesos
               SET estado = 'en_proceso',
                   fecha_inicio_real = COALESCE(fecha_inicio_real, CURRENT_DATE),
                   motivo_bloqueo = NULL
               WHERE id = $1""",
            [proceso_actual["id"]],
        )

        await execute(
            db,
            """UPDATE lotes
               SET estado = 'en_produccion',
                   fecha_inicio_real = COALESCE(fecha_inicio_real, CURRENT_DATE)
               WHERE id = $1""",
            [lote_id],
        )

    return {
        "ok": True,
        "already_started": False,
        "proceso_actual_id": lote["proceso_actual_id"],
    }


async def avanzar_lote_proceso(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    lote_id = payload.get("lote_id")

    if not lote_id:
        raise AppError("Debes indicar el lote.", 400, "VALIDATION")

    async with db.begin():
        actual = await fetch_one(
            db,
            """SELECT lp.id, lp.lote_id, lp.proceso_id, lp.orden, lp.estado,
                      l.fecha_inicio_real AS lote_fecha_inicio_real
               FROM lote_procesos lp
               JOIN lotes l ON l.id = lp.lote_id
               WHERE lp.lote_id = $1
                 AND lp.proceso_id = l.proceso_actual_id
               LIMIT 1""",
            [lote_id],
        )

        if not actual:
            raise AppError(
                "No hay proceso actual configurado para este lote.",
                400,
                "NO_CURRENT_PROCESS",
            )
        if not actual["lote_fecha_inicio_real"]:
            raise AppError(
                "Debes iniciar producción antes de avanzar procesos.",
                400,
                "LOT_NOT_STARTED",
            )

        await execute(
            db,
            """UPDATE lote_procesos
               SET estado = 'completado',
                   fecha_fin_real = COALESCE(fecha_fin_real, CURRENT_DATE)
               WHERE id = $1""",
            [actual["id"]],
        )

        siguiente = await fetch_one(
            db,
            """SELECT id, proceso_id
               FROM lote_procesos
               WHERE lote_id = $1
                 AND orden > $2
                 AND estado IN ('pendiente','bloqueado','omitido')
               ORDER BY orden ASC
               LIMIT 1""",
            [lote_id, actual["orden"]],
        )

        if not siguiente:
            await execute(
                db,
                """UPDATE lotes
                   SET estado = 'empacado',
                       fecha_entrega_real = COALESCE(fecha_entrega_real, CURRENT_DATE)
                   WHERE id = $1""",
                [lote_id],
            )
            return {"completado": True}

        await execute(
            db,
            """UPDATE lote_procesos
               SET estado = 'en_proceso',
                   fecha_inicio_real = COALESCE(fecha_inicio_real, CURRENT_DATE),
                   motivo_bloqueo = NULL
               WHERE id = $1""",
            [siguiente["id"]],
        )

        await execute(
            db,
            """UPDATE lotes
               SET proceso_actual_id = $1,
                   estado = 'en_produccion'
               WHERE id = $2""",
            [siguiente["proceso_id"], lote_id],
        )

    return {"completado": False, "proceso_actual_id": siguiente["proceso_id"]}


async def listar_items_por_lote(db: AsyncSession, payload: dict | None = None) -> list[dict]:
    payload = payload or {}
    lote_id = payload.get("lote_id")

    if not lote_id:
        return []

    return await fetch_all(
        db,
        """SELECT ip.id, ip.proyecto_id, ip.lote_id,
                  ip.nombre, ip.piso, ip.apartamento, ip.estado
           FROM items_proyecto ip
           WHERE ip.lote_id = $1
           ORDER BY ip.nombre ASC, ip.piso ASC NULLS LAST, ip.id ASC""",
        [lote_id],
    )
