from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from src.services.carpentry import (
    bom,
    catalogos,
    dashboard,
    inventario,
    lotes,
    produccion,
    proyectos,
    recursos,
    reportes,
)
from src.services.carpentry.common import fetch_one


async def _ping(db: AsyncSession, _payload: dict | None = None) -> dict:
    row = await fetch_one(db, "SELECT NOW() AS ahora")
    return {"ok": True, "ahora": row["ahora"] if row else datetime.now(timezone.utc)}


ACTION_MAP = {
    "sistema.ping": _ping,
    "dashboard.obtener": dashboard.obtener_dashboard,
    "catalogos.procesos": catalogos.listar_procesos,
    "catalogos.etapas": catalogos.listar_etapas_catalogo,
    "catalogos.areas": catalogos.listar_areas,
    "catalogos.areas.guardar": catalogos.guardar_area,
    "catalogos.areas.eliminar": catalogos.eliminar_area,
    "catalogos.personasActivas": catalogos.listar_personas_activas,
    "catalogos.maquinasActivas": catalogos.listar_maquinas_activas,
    "catalogos.proyectosActivos": catalogos.listar_proyectos_activos,
    "catalogos.lotesActivos": catalogos.listar_lotes_activos,
    "proyectos.listar": proyectos.listar_proyectos,
    "proyectos.guardar": proyectos.guardar_proyecto,
    "proyectos.archivar": proyectos.archivar_proyecto,
    "proyectos.detalle": proyectos.obtener_proyecto_detalle,
    "proyectos.etapa.actualizar": proyectos.actualizar_etapa_proyecto,
    "lotes.listar": lotes.listar_lotes,
    "lotes.guardar": lotes.guardar_lote,
    "lotes.detalle": lotes.obtener_lote_detalle,
    "lotes.proceso.actualizar": lotes.actualizar_lote_proceso,
    "lotes.proceso.iniciar": lotes.iniciar_lote_proceso,
    "lotes.proceso.avanzar": lotes.avanzar_lote_proceso,
    "lotes.listarItems": lotes.listar_items_por_lote,
    "items.listarPorProyecto": bom.listar_items_por_proyecto,
    "items.crear": bom.crear_item,
    "items.crearBulk": bom.crear_items_bulk,
    "items.actualizar": bom.actualizar_item,
    "items.eliminar": bom.eliminar_item,
    "items.asignarLote": bom.asignar_lote,
    "items.desasignarLote": bom.desasignar_lote,
    "items.copiarBom": bom.copiar_bom_a_items,
    "bom.listarPorItem": bom.listar_bom_por_item,
    "bom.guardarMaterial": bom.guardar_material_bom,
    "bom.eliminarMaterial": bom.eliminar_material_bom,
    "materiales.listar": bom.listar_materiales,
    "materiales.guardar": bom.guardar_material,
    "materiales.desactivar": bom.desactivar_material,
    "inventario.stock": inventario.listar_stock,
    "inventario.movimiento.guardar": inventario.registrar_movimiento,
    "inventario.movimientos": inventario.listar_movimientos,
    "inventario.necesidades": inventario.listar_necesidades,
    "produccion.lotesDisponibles": produccion.listar_lotes_produccion,
    "produccion.registrar": produccion.registrar_produccion,
    "produccion.historial": produccion.listar_historial_produccion,
    "produccion.resumenDia": produccion.obtener_resumen_dia,
    "recursos.personas.listar": recursos.listar_personas,
    "recursos.personas.guardar": recursos.guardar_persona,
    "recursos.personas.desactivar": recursos.desactivar_persona,
    "recursos.maquinas.listar": recursos.listar_maquinas,
    "recursos.maquinas.guardar": recursos.guardar_maquina,
    "recursos.maquinas.desactivar": recursos.desactivar_maquina,
    "recursos.cargaSemanal": recursos.listar_carga_semanal,
    "reportes.productividad": reportes.reporte_productividad,
    "reportes.cumplimiento": reportes.reporte_cumplimiento,
    "reportes.consumo": reportes.reporte_consumo_materiales,
    "reportes.bloqueos": reportes.reporte_bloqueos,
    "reportes.avance": reportes.reporte_avance_proyectos,
    "reportes.exportarCsv": reportes.exportar_csv,
}


def list_actions() -> list[str]:
    return sorted(ACTION_MAP.keys())


async def execute_action(db: AsyncSession, action: str, payload: dict | None = None):
    fn = ACTION_MAP.get(action)
    if not fn:
        raise ValueError(f"Acción no soportada: {action}")

    return await fn(db, payload or {})
