from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


# ============================================================
# PROCESO GENERAL
# ============================================================

class ActualizarProcesoRequest(BaseModel):
    lote_proceso_id: int
    responsable_id: Optional[int] = None
    maquina_id: Optional[int] = None
    estado: str
    fecha_inicio_real: Optional[str] = None
    fecha_fin_real: Optional[str] = None
    motivos_bloqueo: Optional[str] = None
    notas: Optional[str] = None


class ConsumoMaterialInput(BaseModel):
    material_id: int
    cantidad_real: float
    notas: Optional[str] = None


class FinalizarProcesoRequest(BaseModel):
    lote_proceso_id: int
    responsable_id: int
    maquina_id: Optional[int] = None
    estado: str = "completado"
    fecha_fin_real: Optional[str] = None
    motivos_bloqueo: Optional[str] = None
    notas: Optional[str] = None
    consumos: Optional[List[ConsumoMaterialInput]] = None


class ConsumoParcialRequest(BaseModel):
    lote_proceso_id: int
    material_id: int
    cantidad_real: float
    notas: Optional[str] = None


# ============================================================
# TAREAS INTERNAS DEL PROCESO
# ============================================================

class GenerarTareasProcesoRequest(BaseModel):
    lote_proceso_id: int


class ActualizarTareaProcesoRequest(BaseModel):
    tarea_id: int
    responsable_id: Optional[int] = None
    maquina_id: Optional[int] = None
    estado: Optional[str] = None
    fecha_inicio_real: Optional[str] = None
    fecha_fin_real: Optional[str] = None
    cantidad_programada: Optional[float] = None
    cantidad_real: Optional[float] = None
    notas: Optional[str] = None


class AsignarResponsableMuebleRequest(BaseModel):
    lote_proceso_id: int
    item_id: int
    responsable_id: int
    maquina_id: Optional[int] = None
    notas: Optional[str] = None


# ============================================================
# PIEZAS / HERRAJES POR MUEBLE
# ============================================================

class AgregarPiezaMuebleRequest(BaseModel):
    lote_id: int
    items_proyecto_id: int
    pieza: str
    cantidad: float
    llegada: bool = False

    pieza_id: Optional[int] = None
    largo_mm: Optional[float] = None
    ancho_mm: Optional[float] = None
    espesor_mm: Optional[float] = None
    material: Optional[str] = None

    descripcion_original: Optional[str] = None
    archivo_origen: Optional[str] = None
    hoja_origen: Optional[str] = None
    fila_excel: Optional[int] = None
    encabezado_mueble: Optional[str] = None
    match_tipo: Optional[str] = None
    match_observacion: Optional[str] = None

    notas: Optional[str] = None


class ActualizarLlegadaPiezaRequest(BaseModel):
    piezas_mueble_id: int
    llegada: bool


class CompletarPiezasMuebleRequest(BaseModel):
    lote_id: int
    items_proyecto_id: int


class ActualizarPiezaMuebleRequest(BaseModel):
    piezas_mueble_id: int

    pieza: Optional[str] = None
    cantidad: Optional[float] = None
    llegada: Optional[bool] = None

    pieza_id: Optional[int] = None
    largo_mm: Optional[float] = None
    ancho_mm: Optional[float] = None
    espesor_mm: Optional[float] = None
    material: Optional[str] = None

    descripcion_original: Optional[str] = None
    archivo_origen: Optional[str] = None
    hoja_origen: Optional[str] = None
    fila_excel: Optional[int] = None
    encabezado_mueble: Optional[str] = None
    match_tipo: Optional[str] = None
    match_observacion: Optional[str] = None

    notas: Optional[str] = None


class EliminarPiezaMuebleRequest(BaseModel):
    piezas_mueble_id: int