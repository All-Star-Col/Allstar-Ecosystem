from sqlalchemy.ext.asyncio import AsyncSession

from src.services.carpentry.common import AppError, clean, execute, fetch_all, fetch_one


def _to_id_array(value) -> list[int]:
    if isinstance(value, list):
        raw = value
    elif value not in (None, ""):
        raw = [value]
    else:
        raw = []

    unique: list[int] = []
    for item in raw:
        try:
            parsed = int(item)
        except (TypeError, ValueError):
            continue
        if parsed > 0 and parsed not in unique:
            unique.append(parsed)
    return unique


def _normalizar_texto(value) -> str:
    return str(value or "").strip().lower()


def _association_relation_ctes() -> str:
    return """
    WITH rp_personas AS (
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
    ),
    rp_maquinas AS (
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
    """


async def _obtener_maquina_seccionado_default(db: AsyncSession) -> int | None:
    rows = await fetch_all(
        db,
        """SELECT m.id
           FROM maquinas m
           JOIN procesos p ON p.id = m.proceso_id
           WHERE m.activo = TRUE
             AND LOWER(p.nombre) = 'seccionado'
           ORDER BY m.id ASC
           LIMIT 2""",
    )

    return rows[0]["id"] if len(rows) == 1 else None


async def listar_lotes_produccion(db: AsyncSession, _payload: dict | None = None) -> list[dict]:
    return await fetch_all(
        db,
        """SELECT l.id, l.nombre, p.nombre AS proyecto,
                  l.proceso_actual_id, pr.nombre AS proceso_actual,
                  l.estado,
                  NOT EXISTS (
                    SELECT 1
                    FROM vista_necesidades_materiales vnm
                    WHERE vnm.lote_id = l.id
                      AND vnm.material_disponible = FALSE
                  ) AS material_completo
           FROM lotes l
           JOIN proyectos p ON p.id = l.proyecto_id
           LEFT JOIN procesos pr ON pr.id = l.proceso_actual_id
           WHERE l.estado IN ('en_produccion', 'bloqueado')
             AND l.fecha_inicio_real IS NOT NULL
           ORDER BY l.prioridad ASC, l.fecha_entrega_prog ASC NULLS LAST, l.nombre ASC""",
    )


async def registrar_produccion(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}

    data = {
        "fecha": clean(payload.get("fecha")),
        "lote_id": clean(payload.get("lote_id")),
        "proceso_id": clean(payload.get("proceso_id")),
        "persona_ids": _to_id_array(payload.get("persona_ids", payload.get("persona_id"))),
        "maquina_ids": _to_id_array(payload.get("maquina_ids", payload.get("maquina_id"))),
        "piezas_procesadas": clean(payload.get("piezas_procesadas")),
        "horas_reales": clean(payload.get("horas_reales")),
        "material_consumido": clean(payload.get("material_consumido")),
        "material_id": clean(payload.get("material_id")),
        "novedad": clean(payload.get("novedad")),
        "tiene_bloqueo": payload.get("tiene_bloqueo") is True,
        "motivo_bloqueo": clean(payload.get("motivo_bloqueo")),
    }

    if not data["lote_id"] or not data["proceso_id"]:
        raise AppError("Lote y proceso son obligatorios.", 400, "VALIDATION")

    if not data["persona_ids"] and not data["maquina_ids"]:
        raise AppError("Debes seleccionar al menos persona o máquina.", 400, "VALIDATION")

    if data["tiene_bloqueo"] and not data["motivo_bloqueo"]:
        raise AppError("Debes registrar el motivo del bloqueo.", 400, "VALIDATION")

    if data["material_consumido"] and not data["material_id"]:
        raise AppError("Si reportas consumo, debes seleccionar un material.", 400, "VALIDATION")

    async with db.begin():
        lote = await fetch_one(
            db,
            """SELECT proyecto_id, fecha_inicio_real
               FROM lotes
               WHERE id = $1""",
            [data["lote_id"]],
        )

        if not lote:
            raise AppError("El lote seleccionado no existe.", 404, "NOT_FOUND")

        proceso = await fetch_one(
            db,
            """SELECT id, nombre
               FROM procesos
               WHERE id = $1""",
            [data["proceso_id"]],
        )

        if not proceso:
            raise AppError("El proceso seleccionado no existe.", 404, "NOT_FOUND")

        proceso_nombre = proceso.get("nombre") or ""
        maquina_ids = list(data["maquina_ids"])

        if not maquina_ids and "seccionado" in _normalizar_texto(proceso_nombre):
            maquina_seccionado_id = await _obtener_maquina_seccionado_default(db)
            if maquina_seccionado_id:
                maquina_ids = [maquina_seccionado_id]

        if not data["persona_ids"] and not maquina_ids:
            raise AppError("Debes seleccionar al menos persona o máquina.", 400, "VALIDATION")

        persona_id_legado = data["persona_ids"][0] if data["persona_ids"] else None
        maquina_id_legado = maquina_ids[0] if maquina_ids else None

        if not lote.get("fecha_inicio_real"):
            raise AppError(
                "Debes iniciar la producción del lote antes de registrar producción.",
                400,
                "LOT_NOT_STARTED",
            )

        insert_rows = await execute(
            db,
            """INSERT INTO registros_produccion (
                 fecha, lote_id, proceso_id, persona_id, maquina_id,
                 piezas_procesadas, material_consumido, material_id,
                 horas_reales, novedad, tiene_bloqueo, motivo_bloqueo
               ) VALUES (
                 COALESCE($1, CURRENT_DATE), $2, $3, $4, $5,
                 $6, $7, $8,
                 $9, $10, $11, $12
               )
               RETURNING id""",
            [
                data["fecha"],
                data["lote_id"],
                data["proceso_id"],
                persona_id_legado,
                maquina_id_legado,
                clean(data["piezas_procesadas"]),
                clean(data["material_consumido"]),
                data["material_id"],
                clean(data["horas_reales"]),
                data["novedad"],
                data["tiene_bloqueo"],
                data["motivo_bloqueo"],
            ],
        )

        registro_id = insert_rows[0]["id"]

        if data["persona_ids"]:
            await execute(
                db,
                """INSERT INTO registros_produccion_personas (registro_id, persona_id)
                   SELECT $1, unnest($2::INT[])
                   ON CONFLICT DO NOTHING""",
                [registro_id, data["persona_ids"]],
            )

        if maquina_ids:
            await execute(
                db,
                """INSERT INTO registros_produccion_maquinas (registro_id, maquina_id)
                   SELECT $1, unnest($2::INT[])
                   ON CONFLICT DO NOTHING""",
                [registro_id, maquina_ids],
            )

        if data["material_consumido"] and data["material_id"]:
            await execute(
                db,
                """INSERT INTO movimientos_inventario (
                     material_id, tipo, cantidad, lote_id, proyecto_id,
                     fecha, referencia, responsable_id, notas
                   ) VALUES ($1, 'salida', $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7, $8)""",
                [
                    data["material_id"],
                    data["material_consumido"],
                    data["lote_id"],
                    lote["proyecto_id"],
                    data["fecha"],
                    "Consumo por registro de producción",
                    persona_id_legado,
                    data["novedad"],
                ],
            )

        if data["tiene_bloqueo"]:
            await execute(
                db,
                """UPDATE lote_procesos
                   SET estado = 'bloqueado',
                       motivo_bloqueo = $1
                   WHERE lote_id = $2
                     AND proceso_id = $3""",
                [data["motivo_bloqueo"], data["lote_id"], data["proceso_id"]],
            )

            await execute(
                db,
                """UPDATE lotes
                   SET estado = 'bloqueado',
                       proceso_actual_id = $1
                   WHERE id = $2""",
                [data["proceso_id"], data["lote_id"]],
            )

    return {"id": registro_id}


async def listar_historial_produccion(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    params = []
    clauses = []
    base_ctes = _association_relation_ctes()

    if filters.get("desde"):
        params.append(filters["desde"])
        clauses.append(f"rp.fecha >= ${len(params)}")
    if filters.get("hasta"):
        params.append(filters["hasta"])
        clauses.append(f"rp.fecha <= ${len(params)}")
    if filters.get("lote_id"):
        params.append(filters["lote_id"])
        clauses.append(f"rp.lote_id = ${len(params)}")
    if filters.get("proceso_id"):
        params.append(filters["proceso_id"])
        clauses.append(f"rp.proceso_id = ${len(params)}")
    if filters.get("persona_id"):
        params.append(filters["persona_id"])
        clauses.append(
            f"EXISTS (SELECT 1 FROM rp_personas rel WHERE rel.registro_id = rp.id AND rel.persona_id = ${len(params)})"
        )
    if filters.get("maquina_id"):
        params.append(filters["maquina_id"])
        clauses.append(
            f"EXISTS (SELECT 1 FROM rp_maquinas rel WHERE rel.registro_id = rp.id AND rel.maquina_id = ${len(params)})"
        )

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    return await fetch_all(
        db,
        f"""{base_ctes}
           SELECT rp.id, rp.fecha, rp.lote_id, l.nombre AS lote,
                  p.nombre AS proyecto, rp.proceso_id, pr.nombre AS proceso,
                  COALESCE(personas.persona, pe.nombre) AS persona,
                  COALESCE(maquinas.maquina, mq.nombre) AS maquina,
                  rp.piezas_procesadas, rp.horas_reales,
                  rp.material_consumido, rp.material_id, mc.nombre AS material,
                  rp.novedad, rp.tiene_bloqueo, rp.motivo_bloqueo, rp.created_at
           FROM registros_produccion rp
           JOIN lotes l ON l.id = rp.lote_id
           JOIN proyectos p ON p.id = l.proyecto_id
           JOIN procesos pr ON pr.id = rp.proceso_id
           LEFT JOIN personas pe ON pe.id = rp.persona_id
           LEFT JOIN maquinas mq ON mq.id = rp.maquina_id
           LEFT JOIN materiales_catalogo mc ON mc.id = rp.material_id
           LEFT JOIN (
             SELECT rel.registro_id,
                    STRING_AGG(pe.nombre, ', ' ORDER BY pe.nombre) AS persona
             FROM rp_personas rel
             JOIN personas pe ON pe.id = rel.persona_id
             GROUP BY rel.registro_id
           ) personas ON personas.registro_id = rp.id
           LEFT JOIN (
             SELECT rel.registro_id,
                    STRING_AGG(mq.nombre, ', ' ORDER BY mq.nombre) AS maquina
             FROM rp_maquinas rel
             JOIN maquinas mq ON mq.id = rel.maquina_id
             GROUP BY rel.registro_id
           ) maquinas ON maquinas.registro_id = rp.id
           {where_sql}
           ORDER BY rp.fecha DESC, rp.created_at DESC""",
        params,
    )


async def obtener_resumen_dia(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    day = payload.get("fecha")

    if not day:
        from datetime import datetime

        day = datetime.now().strftime("%Y-%m-%d")

    base_ctes = _association_relation_ctes()

    piezas_por_proceso = await fetch_all(
        db,
        """SELECT pr.nombre AS proceso,
                  SUM(COALESCE(rp.piezas_procesadas, 0))::INTEGER AS piezas
           FROM registros_produccion rp
           JOIN procesos pr ON pr.id = rp.proceso_id
           WHERE rp.fecha = $1
           GROUP BY pr.nombre
           ORDER BY pr.nombre""",
        [day],
    )

    horas_por_persona = await fetch_all(
        db,
        f"""{base_ctes}
           SELECT pe.nombre AS persona,
                  SUM(COALESCE(rp.horas_reales, 0)) AS horas
           FROM registros_produccion rp
           JOIN rp_personas rel ON rel.registro_id = rp.id
           JOIN personas pe ON pe.id = rel.persona_id
           WHERE rp.fecha = $1
           GROUP BY pe.nombre
           ORDER BY pe.nombre""",
        [day],
    )

    lotes_activos = await fetch_one(
        db,
        """SELECT COUNT(DISTINCT lote_id)::INTEGER AS total
           FROM registros_produccion
           WHERE fecha = $1""",
        [day],
    )

    bloqueos = await fetch_one(
        db,
        """SELECT COUNT(*)::INTEGER AS total
           FROM registros_produccion
           WHERE fecha = $1
             AND tiene_bloqueo = TRUE""",
        [day],
    )

    return {
        "fecha": day,
        "piezasPorProceso": piezas_por_proceso,
        "horasPorPersona": horas_por_persona,
        "lotesActivos": (lotes_activos or {}).get("total", 0),
        "bloqueosDelDia": (bloqueos or {}).get("total", 0),
    }
