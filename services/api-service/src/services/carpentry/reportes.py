from sqlalchemy.ext.asyncio import AsyncSession

from src.services.carpentry.common import AppError, fetch_all, to_csv


async def reporte_productividad(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    params = []
    clauses = []

    if filters.get("desde"):
        params.append(filters["desde"])
        clauses.append(f"vps.semana_inicio >= ${len(params)}")
    if filters.get("hasta"):
        params.append(filters["hasta"])
        clauses.append(f"vps.semana_inicio <= ${len(params)}")

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    return await fetch_all(
        db,
        f"""SELECT vps.semana_inicio,
                  vps.proceso,
                  SUM(COALESCE(vps.piezas_totales, 0))::INTEGER AS piezas_totales,
                  SUM(COALESCE(vps.horas_totales, 0)) AS horas_totales,
                  ROUND(
                    SUM(COALESCE(vps.piezas_totales, 0))::NUMERIC
                    / NULLIF(SUM(COALESCE(vps.horas_totales, 0)), 0),
                  2) AS piezas_por_hora
           FROM vista_produccion_semanal vps
           {where_sql}
           GROUP BY vps.semana_inicio, vps.proceso
           ORDER BY vps.semana_inicio DESC, vps.proceso""",
        params,
    )


async def reporte_cumplimiento(db: AsyncSession, filters: dict | None = None) -> dict:
    filters = filters or {}

    params = []
    clauses = []

    if filters.get("desde"):
        params.append(filters["desde"])
        clauses.append(f"p.fecha_compromiso >= ${len(params)}")
    if filters.get("hasta"):
        params.append(filters["hasta"])
        clauses.append(f"p.fecha_compromiso <= ${len(params)}")

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    detalle = await fetch_all(
        db,
        f"""SELECT p.id, p.nombre AS proyecto, p.cliente AS cliente,
                  p.fecha_compromiso, p.estado,
                  COALESCE(vep.pct_avance, 0) AS pct_avance,
                  COALESCE(vep.alerta, 'AL_DIA') AS alerta
           FROM proyectos p
           LEFT JOIN vista_estado_proyectos vep ON vep.proyecto_id = p.id
           {where_sql}
           ORDER BY p.fecha_compromiso ASC NULLS LAST""",
        params,
    )

    resumen = await fetch_all(
        db,
        f"""SELECT COALESCE(vep.alerta, 'AL_DIA') AS alerta,
                  COUNT(*)::INTEGER AS total
           FROM proyectos p
           LEFT JOIN vista_estado_proyectos vep ON vep.proyecto_id = p.id
           {where_sql}
           GROUP BY COALESCE(vep.alerta, 'AL_DIA')""",
        params,
    )

    return {"resumen": resumen, "detalle": detalle}


async def reporte_consumo_materiales(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    params = []
    clauses = ["m.tipo = 'salida'"]

    if filters.get("desde"):
        params.append(filters["desde"])
        clauses.append(f"m.fecha >= ${len(params)}")
    if filters.get("hasta"):
        params.append(filters["hasta"])
        clauses.append(f"m.fecha <= ${len(params)}")
    if filters.get("proyecto_id"):
        params.append(filters["proyecto_id"])
        clauses.append(f"m.proyecto_id = ${len(params)}")

    where_sql = f"WHERE {' AND '.join(clauses)}"

    return await fetch_all(
        db,
        f"""SELECT mc.nombre AS material,
                  mc.categoria,
                  SUM(m.cantidad) AS consumo_total,
                  mc.unidad_medida,
                  p.nombre AS proyecto
           FROM movimientos_inventario m
           JOIN materiales_catalogo mc ON mc.id = m.material_id
           LEFT JOIN proyectos p ON p.id = m.proyecto_id
           {where_sql}
           GROUP BY mc.nombre, mc.categoria, mc.unidad_medida, p.nombre
           ORDER BY consumo_total DESC, mc.nombre""",
        params,
    )


async def reporte_bloqueos(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    params_rp = []
    clauses_rp = ["rp.tiene_bloqueo = TRUE"]
    params_lp = []
    clauses_lp = ["lp.estado = 'bloqueado'"]

    if filters.get("desde"):
        params_rp.append(filters["desde"])
        clauses_rp.append(f"rp.fecha >= ${len(params_rp)}")

        params_lp.append(filters["desde"])
        clauses_lp.append(f"COALESCE(lp.fecha_inicio_real, CURRENT_DATE) >= ${len(params_lp)}")

    if filters.get("hasta"):
        params_rp.append(filters["hasta"])
        clauses_rp.append(f"rp.fecha <= ${len(params_rp)}")

        params_lp.append(filters["hasta"])
        clauses_lp.append(f"COALESCE(lp.fecha_inicio_real, CURRENT_DATE) <= ${len(params_lp)}")

    rp_rows = await fetch_all(
        db,
        f"""SELECT rp.fecha,
                  p.nombre AS proyecto,
                  l.nombre AS lote,
                  pr.nombre AS proceso,
                  COALESCE(rp.motivo_bloqueo, 'Sin detalle') AS motivo,
                  'registro_produccion' AS origen
           FROM registros_produccion rp
           JOIN lotes l ON l.id = rp.lote_id
           JOIN proyectos p ON p.id = l.proyecto_id
           JOIN procesos pr ON pr.id = rp.proceso_id
           WHERE {' AND '.join(clauses_rp)}
           ORDER BY rp.fecha DESC""",
        params_rp,
    )

    lp_rows = await fetch_all(
        db,
        f"""SELECT COALESCE(lp.fecha_inicio_real, CURRENT_DATE) AS fecha,
                  p.nombre AS proyecto,
                  l.nombre AS lote,
                  pr.nombre AS proceso,
                  COALESCE(lp.motivo_bloqueo, 'Sin detalle') AS motivo,
                  'lote_proceso' AS origen
           FROM lote_procesos lp
           JOIN lotes l ON l.id = lp.lote_id
           JOIN proyectos p ON p.id = l.proyecto_id
           JOIN procesos pr ON pr.id = lp.proceso_id
           WHERE {' AND '.join(clauses_lp)}
           ORDER BY fecha DESC""",
        params_lp,
    )

    combined = rp_rows + lp_rows
    combined.sort(key=lambda row: str(row.get("fecha", "")), reverse=True)
    return combined


async def reporte_avance_proyectos(db: AsyncSession, filters: dict | None = None) -> list[dict]:
    filters = filters or {}

    params = []
    clauses = []

    if filters.get("desde"):
        params.append(filters["desde"])
        clauses.append(f"vep.fecha_compromiso >= ${len(params)}")
    if filters.get("hasta"):
        params.append(filters["hasta"])
        clauses.append(f"vep.fecha_compromiso <= ${len(params)}")

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    return await fetch_all(
        db,
        f"""SELECT vep.proyecto_id, vep.proyecto, vep.cliente,
                  vep.fecha_compromiso, vep.dias_a_compromiso,
                  vep.pct_avance, vep.alerta, vep.estado,
                  vep.total_lotes, vep.lotes_completados, vep.lotes_bloqueados,
                  vep.lotes_en_produccion
           FROM vista_estado_proyectos vep
           {where_sql}
           ORDER BY vep.fecha_compromiso ASC NULLS LAST, vep.proyecto""",
        params,
    )


async def exportar_csv(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}

    tipo = payload.get("tipo")
    filtros = payload.get("filtros") or {}

    if tipo == "productividad":
        rows = await reporte_productividad(db, filtros)
    elif tipo == "cumplimiento":
        data = await reporte_cumplimiento(db, filtros)
        rows = data["detalle"]
    elif tipo == "consumo":
        rows = await reporte_consumo_materiales(db, filtros)
    elif tipo == "bloqueos":
        rows = await reporte_bloqueos(db, filtros)
    elif tipo == "avance":
        rows = await reporte_avance_proyectos(db, filtros)
    else:
        raise AppError("Tipo de reporte no soportado para exportación.", 400, "REPORT_TYPE")

    return {
        "csv": to_csv(rows),
        "total": len(rows),
    }
