from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class GenericTabletRequest(BaseModel):
    model_config = ConfigDict(extra="allow")


class ActualizarProcesoRequest(GenericTabletRequest):
    lote_proceso_id: int
    responsable_id: int | None = None
    maquina_id: int | None = None
    estado: str = "pendiente"
    fecha_inicio_real: str | None = None
    fecha_fin_real: str | None = None
    motivos_bloqueo: str | None = None
    motivo_bloqueo: str | None = None
    notas: str | None = None


class ConsumoMaterialInput(BaseModel):
    material_id: int
    cantidad_real: float
    notas: str | None = None


class FinalizarProcesoRequest(GenericTabletRequest):
    lote_proceso_id: int
    responsable_id: int | None = None
    maquina_id: int | None = None
    estado: str = "completado"
    fecha_fin_real: str | None = None
    motivos_bloqueo: str | None = None
    motivo_bloqueo: str | None = None
    notas: str | None = None
    consumos: list[ConsumoMaterialInput] | None = None


class ConsumoParcialRequest(BaseModel):
    lote_proceso_id: int
    material_id: int
    cantidad_real: float
    notas: str | None = None


class GenerarTareasProcesoRequest(BaseModel):
    lote_proceso_id: int


class ActualizarTareaProcesoRequest(GenericTabletRequest):
    tarea_id: int
    responsable_id: int | None = None
    maquina_id: int | None = None
    estado: str | None = None
    fecha_inicio_real: str | None = None
    fecha_fin_real: str | None = None
    cantidad_programada: float | None = None
    cantidad_real: float | None = None
    notas: str | None = None


class AsignarResponsableMuebleRequest(BaseModel):
    lote_proceso_id: int
    item_id: int
    responsable_id: int
    maquina_id: int | None = None
    notas: str | None = None


class AgregarPiezaMuebleRequest(GenericTabletRequest):
    lote_id: int
    items_proyecto_id: int
    pieza: str
    cantidad: float
    llegada: bool = False
    pieza_id: int | None = None
    largo_mm: float | None = None
    ancho_mm: float | None = None
    espesor_mm: float | None = None
    material: str | None = None
    descripcion_original: str | None = None
    archivo_origen: str | None = None
    hoja_origen: str | None = None
    fila_excel: int | None = None
    encabezado_mueble: str | None = None
    match_tipo: str | None = None
    match_observacion: str | None = None
    notas: str | None = None


class ActualizarLlegadaPiezaRequest(BaseModel):
    piezas_mueble_id: int
    llegada: bool


class CompletarPiezasMuebleRequest(BaseModel):
    lote_id: int
    items_proyecto_id: int


class ActualizarPiezaMuebleRequest(GenericTabletRequest):
    piezas_mueble_id: int
    pieza: str | None = None
    cantidad: float | None = None
    llegada: bool | None = None
    pieza_id: int | None = None
    largo_mm: float | None = None
    ancho_mm: float | None = None
    espesor_mm: float | None = None
    material: str | None = None
    descripcion_original: str | None = None
    archivo_origen: str | None = None
    hoja_origen: str | None = None
    fila_excel: int | None = None
    encabezado_mueble: str | None = None
    match_tipo: str | None = None
    match_observacion: str | None = None
    notas: str | None = None


class EliminarPiezaMuebleRequest(BaseModel):
    piezas_mueble_id: int


class ActualizarLlegadaHerrajeRequest(BaseModel):
    lote_proceso_id: int
    item_id: int
    material_id: int
    llegada: bool
    notas: str | None = None


class SincronizarHerrajesRequest(BaseModel):
    lote_proceso_id: int | None = None


class ConsumoCantoRequest(BaseModel):
    lote_proceso_id: int
    material_id: int
    ubicacion: str
    cantidad_real: float
    notas: str | None = None


class FirmaInstalacionMuebleRequest(BaseModel):
    lote_proceso_id: int
    item_id: int
    responsable_id: int | None = None
    nombre_responsable: str | None = None
    firma_base64: str
    observacion: str | None = None


class CompletarPiezasApartamentoRequest(BaseModel):
    lote_id: int
    apartamento: str


class FirmaInstalacionApartamentoRequest(BaseModel):
    lote_proceso_id: int
    lote_id: int | None = None
    apartamento: str
    cliente: str | None = None
    responsable_id: int | None = None
    nombre_responsable: str | None = None
    firma_base64: str
    observacion: str | None = None


class ActualizarComentarioActaClienteRequest(BaseModel):
    comentario: str | None = None


class ConsumoSinLoteRequest(BaseModel):
    proyecto_id: int
    proyecto_nombre: str | None = None
    cliente: str | None = None
    proceso_nombre: str
    tipo_material: str
    nombre_produccion: str
    material_id: int
    material_nombre: str | None = None
    unidad_medida: str | None = None
    cantidad_consumida: float
    ubicacion: str | None = None
    observacion: str | None = None
    usuario: str | None = "tablet"


class RawPayload(GenericTabletRequest):
    payload: dict[str, Any] = Field(default_factory=dict)
