from sqlalchemy.ext.asyncio import AsyncSession

from src.services.carpentry.common import fetch_all, fetch_one


async def obtener_dashboard(db: AsyncSession, payload: dict | None = None) -> dict:
    payload = payload or {}
    alerta = payload.get("alerta")

    params: list = []
    where_alerta = ""

    if alerta and alerta != "todos":
        params.append(alerta)
        where_alerta = "WHERE vep.alerta = $1"

    proyectos = await fetch_all(
        db,
        f"""SELECT vep.proyecto_id, vep.proyecto, vep.cliente, vep.fecha_compromiso,
                  vep.dias_a_compromiso, COALESCE(vep.pct_avance, 0) AS pct_avance,
                  COALESCE(vep.pct_avance_granular, 0) AS pct_avance_granular,
                  vep.alerta, vep.responsable
           FROM vista_estado_proyectos vep
           {where_alerta}
           ORDER BY vep.fecha_compromiso ASC NULLS LAST, vep.proyecto ASC""",
        params,
    )

    lotes_bloqueados = await fetch_all(
        db,
        """SELECT l.id AS lote_id,
                  l.nombre AS lote,
                  p.nombre AS proyecto,
                  pr.nombre AS proceso_actual,
                  COALESCE(lp.motivo_bloqueo, l.notas, 'Sin detalle') AS motivo_bloqueo
           FROM lotes l
           JOIN proyectos p ON p.id = l.proyecto_id
           LEFT JOIN procesos pr ON pr.id = l.proceso_actual_id
           LEFT JOIN lote_procesos lp ON lp.lote_id = l.id
                                    AND lp.proceso_id = l.proceso_actual_id
           WHERE l.estado = 'bloqueado'
           ORDER BY p.nombre, l.nombre""",
    )

    alertas_materiales = await fetch_all(
        db,
        """SELECT vnm.proyecto_id,
                  vnm.proyecto,
                  vnm.lote_id,
                  vnm.lote,
                  json_agg(
                    json_build_object(
                      'material', vnm.material,
                      'cantidad_pendiente', vnm.cantidad_pendiente,
                      'unidad_medida', vnm.unidad_medida
                    )
                    ORDER BY vnm.material
                  ) AS faltantes
           FROM vista_necesidades_materiales vnm
           WHERE vnm.material_disponible = FALSE
           GROUP BY vnm.proyecto_id, vnm.proyecto, vnm.lote_id, vnm.lote
           ORDER BY vnm.proyecto, vnm.lote""",
    )

    carga_activa = await fetch_all(
        db,
        """SELECT tipo_recurso, recurso_id, recurso, proceso,
                  capacidad_semanal_horas,
                  lotes_en_proceso,
                  horas_carga_estimada,
                  COALESCE(pct_ocupacion_planificada, 0) AS pct_ocupacion_planificada,
                  horas_registradas_semana,
                  lotes_activos,
                  COALESCE(pct_ocupacion_real, 0)        AS pct_ocupacion_real
           FROM vista_carga_activa
           ORDER BY proceso, tipo_recurso, recurso""",
    )

    produccion_semanal = await fetch_all(
        db,
        """SELECT semana_inicio, proceso,
                  SUM(COALESCE(piezas_totales, 0)) AS piezas_totales
           FROM vista_produccion_semanal
           GROUP BY semana_inicio, proceso
           ORDER BY semana_inicio DESC, proceso""",
    )

    kpis = await fetch_one(
        db,
        """SELECT
              (SELECT COUNT(*)::INTEGER FROM proyectos WHERE estado <> 'finalizado') AS proyectos_activos,
              (SELECT COUNT(*)::INTEGER FROM lotes WHERE estado IN ('pendiente','en_produccion','bloqueado','empacado','instalacion','despachado')) AS lotes_activos,
              (SELECT COUNT(*)::INTEGER FROM lotes WHERE estado = 'bloqueado') AS lotes_bloqueados,
              (SELECT COUNT(DISTINCT lote_id)::INTEGER FROM vista_necesidades_materiales WHERE material_disponible = FALSE) AS lotes_con_faltantes""",
    )

    return {
        "kpis": kpis,
        "proyectos": proyectos,
        "lotesBloqueados": lotes_bloqueados,
        "alertasMateriales": alertas_materiales,
        "cargaActiva": carga_activa,
        "produccionSemanal": produccion_semanal,
    }
