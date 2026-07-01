from __future__ import annotations

from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from src.schemas.tablet_carpentry import (
    ActualizarComentarioActaClienteRequest,
    ActualizarLlegadaHerrajeRequest,
    ActualizarLlegadaPiezaRequest,
    ActualizarPiezaMuebleRequest,
    ActualizarProcesoRequest,
    ActualizarTareaProcesoRequest,
    AgregarPiezaMuebleRequest,
    AsignarResponsableMuebleRequest,
    CompletarPiezasApartamentoRequest,
    CompletarPiezasMuebleRequest,
    ConsumoCantoRequest,
    ConsumoParcialRequest,
    ConsumoSinLoteRequest,
    EliminarPiezaMuebleRequest,
    FinalizarProcesoRequest,
    FirmaInstalacionApartamentoRequest,
    FirmaInstalacionMuebleRequest,
    GenerarTareasProcesoRequest,
    SincronizarHerrajesRequest,
)
from src.services.azure_storage import AzureStorageNotConfigured
from src.services.tablet import carpentry as carpentry_service

router = APIRouter()


def _body(model: Any) -> dict[str, Any]:
    return model.model_dump(exclude_none=True)


def _raise_api_error(exc: Exception, message: str = "Error ejecutando API de carpinteria.") -> None:
    if isinstance(exc, HTTPException):
        raise exc
    if isinstance(exc, AzureStorageNotConfigured):
        raise HTTPException(
            status_code=503,
            detail={
                "ok": False,
                "mensaje": str(exc),
                "error": "AZURE_STORAGE_NOT_CONFIGURED",
            },
        )
    raise HTTPException(
        status_code=500,
        detail={
            "ok": False,
            "mensaje": message,
            "error": str(exc),
        },
    )


@router.get("/")
async def root() -> dict[str, Any]:
    return {
        "ok": True,
        "mensaje": "API Seguimiento Produccion Carpinteria activa.",
        "version": "1.0.0",
    }


@router.get("/health")
async def health() -> dict[str, Any]:
    try:
        return await carpentry_service.call_db_function("get_health")
    except Exception as exc:
        return {
            "ok": False,
            "mensaje": "La API inicio, pero el modulo de produccion carpinteria no respondio.",
            "error": str(exc),
        }


@router.get("/procesos")
async def procesos(piso: int = Query(...)) -> Any:
    try:
        return await carpentry_service.call_first_available(["get_procesos"], piso)
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/procesos-seccion")
async def procesos_seccion(seccion: str = Query(...)) -> Any:
    try:
        return await carpentry_service.call_first_available(["get_procesos_seccion"], seccion)
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/modo-proceso")
async def modo_proceso(lote_proceso_id: int = Query(...)) -> Any:
    try:
        return await carpentry_service.call_first_available(["get_modo_proceso"], lote_proceso_id)
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/proyectos")
async def proyectos(proceso_id: int = Query(...)) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_proyectos", "get_proyectos_por_proceso"],
            proceso_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/lotes")
async def lotes(
    proyecto_id: int = Query(...),
    proceso_id: int = Query(...),
) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_lotes", "get_lotes_por_proyecto_proceso"],
            proyecto_id,
            proceso_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/lote-proceso/{lote_proceso_id}")
async def lote_proceso(lote_proceso_id: int) -> Any:
    try:
        return await carpentry_service.call_first_available(["get_lote_proceso"], lote_proceso_id)
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/responsables")
async def responsables(proceso_id: int = Query(...)) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_responsables", "get_responsables_proceso"],
            proceso_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/maquinas")
async def maquinas(proceso_id: int = Query(...)) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_maquinas", "get_maquinas_proceso"],
            proceso_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/muebles-lote")
async def muebles_lote(lote_id: int = Query(...)) -> Any:
    try:
        return await carpentry_service.call_first_available(["get_muebles_lote"], lote_id)
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/inventario")
async def inventario(categoria: str | None = None) -> Any:
    try:
        if categoria:
            return await carpentry_service.call_first_available(["get_inventario"], categoria)
        return await carpentry_service.call_first_available(["get_inventarios"])
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/materiales-consumo")
async def materiales_consumo(
    lote_id: int = Query(...),
    proceso_id: int = Query(...),
) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_materiales_consumo"],
            lote_id,
            proceso_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/materiales-consumo-detalle")
async def materiales_consumo_detalle(
    lote_id: int = Query(...),
    proceso_id: int = Query(...),
) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_materiales_consumo_detalle", "obtener_materiales_consumo_detalle"],
            lote_id,
            proceso_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/consumos-acumulados")
async def consumos_acumulados(lote_proceso_id: int = Query(...)) -> Any:
    try:
        return await carpentry_service.call_first_available(["get_consumos_acumulados"], lote_proceso_id)
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/consumo-parcial")
async def consumo_parcial(request: ConsumoParcialRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["registrar_consumo_parcial"],
            request.lote_proceso_id,
            request.material_id,
            request.cantidad_real,
            request.notas,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/completar-piezas-apartamento")
async def completar_piezas_apartamento(request: CompletarPiezasApartamentoRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["completar_piezas_apartamento"],
            request.lote_id,
            request.apartamento,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/inventario-cantos")
async def inventario_cantos() -> Any:
    try:
        return await carpentry_service.call_first_available(["get_inventario_cantos"])
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/consumo-canto")
async def consumo_canto(request: ConsumoCantoRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["registrar_consumo_canto"],
            request.lote_proceso_id,
            request.material_id,
            request.ubicacion,
            request.cantidad_real,
            request.notas,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/actualizar-proceso")
async def actualizar_proceso(request: ActualizarProcesoRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["actualizar_proceso", "iniciar_lote_proceso"],
            **_body(request),
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/finalizar-proceso")
async def finalizar_proceso(request: FinalizarProcesoRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["finalizar_proceso", "finalizar_lote_proceso"],
            **_body(request),
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/tareas-proceso")
async def tareas_proceso(lote_proceso_id: int = Query(...)) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_tareas_proceso", "obtener_tareas_proceso"],
            lote_proceso_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/generar-tareas-proceso")
async def generar_tareas_proceso(request: GenerarTareasProcesoRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["generar_tareas_proceso"],
            request.lote_proceso_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/actualizar-tarea-proceso")
async def actualizar_tarea_proceso(request: ActualizarTareaProcesoRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["actualizar_tarea_proceso", "actualizar_tarea"],
            **_body(request),
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/asignar-responsable-mueble")
async def asignar_responsable_mueble(request: AsignarResponsableMuebleRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["asignar_responsable_mueble"],
            **_body(request),
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/piezas")
async def piezas() -> Any:
    try:
        return await carpentry_service.call_first_available(["get_piezas"])
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/piezas-mueble")
async def piezas_mueble(
    lote_id: int | None = Query(None),
    item_id: int | None = Query(None),
) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_piezas_mueble"],
            lote_id=lote_id,
            item_id=item_id,
        )
    except Exception as exc:
        if lote_id is not None and item_id is None:
            try:
                return await carpentry_service.call_first_available(["get_piezas_mueble"], lote_id)
            except Exception as fallback_exc:
                _raise_api_error(fallback_exc)
        _raise_api_error(exc)


@router.post("/agregar-pieza-mueble")
async def agregar_pieza_mueble(request: AgregarPiezaMuebleRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(["agregar_pieza_mueble"], **_body(request))
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/actualizar-llegada-pieza")
async def actualizar_llegada_pieza(request: ActualizarLlegadaPiezaRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["actualizar_llegada_pieza", "actualizar_llegada_pieza_mueble"],
            piezas_mueble_id=request.piezas_mueble_id,
            llegada=request.llegada,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/completar-piezas-mueble")
async def completar_piezas_mueble(request: CompletarPiezasMuebleRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["completar_piezas_mueble"],
            request.lote_id,
            request.items_proyecto_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/actualizar-pieza-mueble")
async def actualizar_pieza_mueble(request: ActualizarPiezaMuebleRequest) -> Any:
    try:
        payload = _body(request)
        piezas_mueble_id = payload.pop("piezas_mueble_id")
        return await carpentry_service.call_first_available(
            ["actualizar_pieza_mueble"],
            piezas_mueble_id,
            **payload,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/eliminar-pieza-mueble")
async def eliminar_pieza_mueble(request: EliminarPiezaMuebleRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["eliminar_pieza_mueble"],
            request.piezas_mueble_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/muebles-instalacion")
async def muebles_instalacion(lote_proceso_id: int = Query(...)) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_muebles_instalacion", "obtener_muebles_instalacion"],
            lote_proceso_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/actualizar-llegada-herraje")
async def actualizar_llegada_herraje(request: ActualizarLlegadaHerrajeRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["actualizar_llegada_herraje"],
            request.lote_proceso_id,
            request.item_id,
            request.material_id,
            request.llegada,
            request.notas,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/sincronizar-herrajes-instalacion")
async def sincronizar_herrajes_instalacion(request: SincronizarHerrajesRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["sincronizar_herrajes_mueble_llegada", "sincronizar_herrajes_instalacion"],
            request.lote_proceso_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/firmar-instalacion-mueble")
async def firmar_instalacion_mueble(request: FirmaInstalacionMuebleRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["firmar_instalacion_mueble"],
            request.lote_proceso_id,
            request.item_id,
            request.responsable_id,
            request.nombre_responsable,
            request.firma_base64,
            request.observacion,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/firmar-instalacion-apartamento")
async def firmar_instalacion_apartamento(request: FirmaInstalacionApartamentoRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["firmar_instalacion_apartamento"],
            request.lote_proceso_id,
            request.lote_id,
            request.apartamento,
            request.cliente,
            request.responsable_id,
            request.nombre_responsable,
            request.firma_base64,
            request.observacion,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/firmas-instalacion-apartamentos")
async def firmas_instalacion_apartamentos(lote_proceso_id: int) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_firmas_instalacion_apartamentos"],
            lote_proceso_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/firma-instalacion-mueble")
async def firma_instalacion_mueble(lote_proceso_id: int, item_id: int) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_firma_instalacion_mueble"],
            lote_proceso_id,
            item_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/actas-entrega-cliente")
async def crear_acta_entrega_cliente(
    lote_proceso_id: int = Form(...),
    lote_id: int | None = Form(None),
    cliente: str = Form(...),
    lote_nombre: str | None = Form(None),
    apartamentos: str = Form(...),
    obra1_nombre: str | None = Form(None),
    obra1_cargo: str | None = Form(None),
    obra1_firma_base64: str | None = Form(None),
    obra2_nombre: str | None = Form(None),
    obra2_cargo: str | None = Form(None),
    obra2_firma_base64: str | None = Form(None),
    allstar_nombre: str | None = Form(None),
    allstar_cargo: str | None = Form(None),
    allstar_firma_base64: str | None = Form(None),
    comentario: str | None = Form(None),
    archivo: UploadFile = File(...),
) -> Any:
    try:
        pdf_bytes = await archivo.read()
        return await carpentry_service.upload_acta_entrega_cliente(
            pdf_bytes=pdf_bytes,
            nombre_archivo=archivo.filename or f"acta_cliente_{lote_proceso_id}.pdf",
            lote_proceso_id=lote_proceso_id,
            lote_id=lote_id,
            cliente=cliente,
            lote_nombre=lote_nombre,
            apartamentos=apartamentos,
            obra1_nombre=obra1_nombre,
            obra1_cargo=obra1_cargo,
            obra1_firma_base64=obra1_firma_base64,
            obra2_nombre=obra2_nombre,
            obra2_cargo=obra2_cargo,
            obra2_firma_base64=obra2_firma_base64,
            allstar_nombre=allstar_nombre,
            allstar_cargo=allstar_cargo,
            allstar_firma_base64=allstar_firma_base64,
            comentario=comentario,
            content_type=archivo.content_type,
        )
    except Exception as exc:
        _raise_api_error(exc, "No fue posible crear el acta de entrega cliente.")


@router.get("/actas-entrega-cliente")
async def listar_actas_entrega_cliente(
    lote_proceso_id: int | None = None,
    lote_id: int | None = None,
) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["get_actas_entrega_cliente"],
            lote_proceso_id,
            lote_id,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.patch("/actas-entrega-cliente/{acta_id}/comentario")
async def actualizar_comentario_acta_cliente(
    acta_id: int,
    request: ActualizarComentarioActaClienteRequest,
) -> Any:
    try:
        result = await carpentry_service.call_db_function(
            "actualizar_comentario_acta_cliente",
            acta_id=acta_id,
            comentario=request.comentario,
        )
        if isinstance(result, dict) and not result.get("ok", True):
            raise HTTPException(status_code=404, detail=result)
        return result
    except Exception as exc:
        _raise_api_error(exc, "No fue posible actualizar el comentario del acta.")


@router.delete("/actas-entrega-cliente/{acta_id}")
async def eliminar_acta_entrega_cliente(acta_id: int) -> Any:
    try:
        result = await carpentry_service.call_db_function(
            "eliminar_acta_entrega_cliente",
            acta_id=acta_id,
        )
        if isinstance(result, dict) and not result.get("ok", True):
            raise HTTPException(status_code=404, detail=result)
        return result
    except Exception as exc:
        _raise_api_error(exc, "No fue posible eliminar el acta cliente.")


@router.get("/actas-entrega-cliente/{acta_id}/pdf")
async def descargar_acta_entrega_cliente_pdf(
    acta_id: int,
    disposition: str = Query("attachment", pattern="^(inline|attachment)$"),
) -> StreamingResponse:
    try:
        pdf_bytes, filename = await carpentry_service.download_acta_pdf(acta_id)
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
        )
    except Exception as exc:
        _raise_api_error(exc, "No fue posible descargar el acta desde Azure.")


@router.post("/consumo-sin-lote")
async def consumo_sin_lote(request: ConsumoSinLoteRequest) -> Any:
    try:
        return await carpentry_service.call_first_available(
            ["registrar_consumo_sin_lote"],
            request.proyecto_id,
            request.proyecto_nombre,
            request.cliente,
            request.proceso_nombre,
            request.tipo_material,
            request.nombre_produccion,
            request.material_id,
            request.material_nombre,
            request.unidad_medida,
            request.cantidad_consumida,
            request.ubicacion,
            request.observacion,
            request.usuario,
        )
    except Exception as exc:
        _raise_api_error(exc)


@router.get("/consumos-sin-lote")
async def consumos_sin_lote(proyecto_id: int | None = None) -> Any:
    try:
        return await carpentry_service.call_first_available(["get_consumos_sin_lote"], proyecto_id)
    except Exception as exc:
        _raise_api_error(exc)


@router.post("/planos-proyecto")
async def subir_plano_proyecto(
    proyecto_id: int = Form(...),
    lote_id: int | None = Form(None),
    proyecto_nombre: str | None = Form(None),
    lote_nombre: str | None = Form(None),
    cliente: str | None = Form(None),
    nombre_plano: str = Form(...),
    descripcion: str | None = Form(None),
    usuario: str | None = Form("tablet"),
    archivo: UploadFile = File(...),
) -> Any:
    try:
        pdf_bytes = await archivo.read()
        result = await carpentry_service.upload_plano_proyecto(
            pdf_bytes=pdf_bytes,
            proyecto_id=proyecto_id,
            lote_id=lote_id,
            proyecto_nombre=proyecto_nombre,
            lote_nombre=lote_nombre,
            cliente=cliente,
            nombre_plano=nombre_plano,
            descripcion=descripcion,
            usuario=usuario,
            filename=archivo.filename or f"{nombre_plano}.pdf",
        )
        if isinstance(result, dict) and not result.get("ok", True):
            raise HTTPException(status_code=400, detail=result)
        return result
    except Exception as exc:
        _raise_api_error(exc, "No fue posible subir el plano del proyecto.")


@router.get("/planos-proyecto")
async def listar_planos_proyecto(proyecto_id: int, lote_id: int | None = None) -> Any:
    try:
        result = await carpentry_service.call_db_function(
            "get_planos_proyecto",
            proyecto_id=proyecto_id,
            lote_id=lote_id,
        )
        if isinstance(result, dict) and not result.get("ok", True):
            raise HTTPException(status_code=404, detail=result)
        return result
    except Exception as exc:
        _raise_api_error(exc, "No fue posible consultar los planos del proyecto.")


@router.get("/planos-proyecto/{plano_id}/pdf")
async def descargar_plano_proyecto_pdf(plano_id: int) -> StreamingResponse:
    try:
        pdf_bytes, filename = await carpentry_service.download_plano_pdf(plano_id)
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        _raise_api_error(exc, "No fue posible descargar el plano.")


@router.delete("/planos-proyecto/{plano_id}")
async def eliminar_plano_proyecto(plano_id: int) -> Any:
    try:
        result = await carpentry_service.call_db_function(
            "eliminar_plano_proyecto",
            plano_id=plano_id,
        )
        if isinstance(result, dict) and not result.get("ok", True):
            raise HTTPException(status_code=404, detail=result)
        return result
    except Exception as exc:
        _raise_api_error(exc, "No fue posible eliminar el plano.")
