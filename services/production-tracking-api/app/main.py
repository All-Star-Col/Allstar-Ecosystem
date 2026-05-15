from __future__ import annotations

import importlib
import inspect
import traceback
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="All Star - Seguimiento Producción API",
    version="1.0.0",
    description="API para seguimiento de producción, despacho e instalación.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MODELOS BASE
# ============================================================

class GenericResponse(BaseModel):
    ok: bool = True
    mensaje: str = "OK"


class ActualizarProcesoRequest(BaseModel):
    lote_proceso_id: int
    responsable_id: Optional[int] = None
    maquina_id: Optional[int] = None
    estado: str = "pendiente"
    fecha_inicio_real: Optional[str] = None
    fecha_fin_real: Optional[str] = None
    motivos_bloqueo: Optional[str] = None
    motivo_bloqueo: Optional[str] = None
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
    motivo_bloqueo: Optional[str] = None
    notas: Optional[str] = None
    consumos: Optional[List[ConsumoMaterialInput]] = None


class ConsumoParcialRequest(BaseModel):
    lote_proceso_id: int
    material_id: int
    cantidad_real: float
    notas: Optional[str] = None


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


class ActualizarLlegadaHerrajeRequest(BaseModel):
    lote_proceso_id: int
    item_id: int
    material_id: int
    llegada: bool
    notas: Optional[str] = None


class SincronizarHerrajesRequest(BaseModel):
    lote_proceso_id: Optional[int] = None


# ============================================================
# HELPERS COMPATIBILIDAD sql_db.py
# ============================================================

def _import_sql_db():
    """
    Importación diferida.
    Esto evita que toda la API se caiga al iniciar si sql_db.py tiene un error.
    El error se verá en /health o en el endpoint específico.
    """
    try:
        return importlib.import_module("app.sql_db")
    except Exception as exc:
        print("========== ERROR IMPORTANDO sql_db.py ==========")
        traceback.print_exc()
        print("========== FIN ERROR IMPORTANDO sql_db.py ==========")

        raise HTTPException(
            status_code=500,
            detail={
                "ok": False,
                "mensaje": "No fue posible importar app.sql_db.",
                "error": str(exc),
            },
        )


def _function_exists(module: Any, function_name: str) -> bool:
    return hasattr(module, function_name) and callable(getattr(module, function_name))


def _function_needs_db(function: Any) -> bool:
    try:
        signature = inspect.signature(function)
        params = list(signature.parameters.values())

        if not params:
            return False

        first_name = params[0].name.lower()
        return first_name in {"db", "session"}

    except Exception:
        return False


@contextmanager
def _db_session(module: Any):
    """
    Soporta sql_db.py con:
    - SessionLocal()
    - get_db() como generator
    - get_db() como context manager
    """
    db = None

    if hasattr(module, "SessionLocal"):
        db = module.SessionLocal()
        try:
            yield db
        finally:
            try:
                db.close()
            except Exception:
                pass
        return

    if hasattr(module, "get_db"):
        get_db = getattr(module, "get_db")

        maybe = get_db()

        if hasattr(maybe, "__enter__") and hasattr(maybe, "__exit__"):
            with maybe as db_obj:
                yield db_obj
            return

        generator = maybe
        db = next(generator)

        try:
            yield db
        finally:
            try:
                next(generator)
            except StopIteration:
                pass
            except Exception:
                pass

        return

    raise RuntimeError(
        "sql_db.py no tiene SessionLocal ni get_db compatible para abrir sesión."
    )


def _call_db_function(function_name: str, *args, **kwargs):
    module = _import_sql_db()

    if not _function_exists(module, function_name):
        raise HTTPException(
            status_code=500,
            detail={
                "ok": False,
                "mensaje": f"La función {function_name} no existe en sql_db.py.",
            },
        )

    function = getattr(module, function_name)

    try:
        if _function_needs_db(function):
            with _db_session(module) as db:
                result = function(db, *args, **kwargs)
        else:
            result = function(*args, **kwargs)

        return jsonable_encoder(result)

    except HTTPException:
        raise

    except TypeError as exc:
        print("========== ERROR DE PARÁMETROS API ==========")
        traceback.print_exc()
        print("========== FIN ERROR DE PARÁMETROS API ==========")

        raise HTTPException(
            status_code=500,
            detail={
                "ok": False,
                "mensaje": f"Error de parámetros ejecutando {function_name}.",
                "error": str(exc),
            },
        )

    except Exception as exc:
        print("========== ERROR API ==========")
        traceback.print_exc()
        print("========== FIN ERROR ==========")

        raise HTTPException(
            status_code=500,
            detail={
                "ok": False,
                "mensaje": f"Error ejecutando {function_name}.",
                "error": str(exc),
            },
        )


def _call_first_available(function_names: List[str], *args, **kwargs):
    module = _import_sql_db()

    for function_name in function_names:
        if _function_exists(module, function_name):
            return _call_db_function(function_name, *args, **kwargs)

    raise HTTPException(
        status_code=500,
        detail={
            "ok": False,
            "mensaje": f"No existe ninguna de estas funciones en sql_db.py: {function_names}",
        },
    )


def _body_dict(model: BaseModel, exclude_none: bool = False) -> Dict[str, Any]:
    return model.model_dump(exclude_none=exclude_none)


# ============================================================
# ROOT / HEALTH
# ============================================================

@app.get("/")
def root():
    return {
        "ok": True,
        "mensaje": "API Seguimiento Producción activa.",
    }


@app.get("/health")
def health():
    try:
        module = importlib.import_module("app.sql_db")
    except Exception as exc:
        print("========== ERROR HEALTH / IMPORT sql_db.py ==========")
        traceback.print_exc()
        print("========== FIN ERROR HEALTH ==========")

        return {
            "ok": False,
            "mensaje": "La API inició, pero sql_db.py no se pudo importar.",
            "error": str(exc),
        }

    if _function_exists(module, "get_health"):
        try:
            return _call_db_function("get_health")
        except HTTPException as exc:
            return {
                "ok": False,
                "mensaje": "Error ejecutando get_health.",
                "detail": exc.detail,
            }

    return {
        "ok": True,
        "mensaje": "API activa. sql_db.py importado correctamente.",
        "sql_db_importado": True,
    }


# ============================================================
# PROCESOS / PROYECTOS / LOTES
# ============================================================

@app.get("/procesos")
def procesos(piso: int = Query(...)):
    return _call_first_available(
        ["get_procesos"],
        piso,
    )


@app.get("/procesos-seccion")
def procesos_seccion(seccion: str = Query(...)):
    return _call_first_available(
        ["get_procesos_seccion"],
        seccion,
    )


@app.get("/modo-proceso")
def modo_proceso(lote_proceso_id: int = Query(...)):
    return _call_first_available(
        ["get_modo_proceso"],
        lote_proceso_id,
    )


@app.get("/proyectos")
def proyectos(proceso_id: int = Query(...)):
    return _call_first_available(
        ["get_proyectos", "get_proyectos_por_proceso"],
        proceso_id,
    )


@app.get("/lotes")
def lotes(
    proyecto_id: int = Query(...),
    proceso_id: int = Query(...),
):
    return _call_first_available(
        ["get_lotes", "get_lotes_por_proyecto_proceso"],
        proyecto_id,
        proceso_id,
    )


@app.get("/lote-proceso/{lote_proceso_id}")
def lote_proceso(lote_proceso_id: int):
    return _call_first_available(
        ["get_lote_proceso"],
        lote_proceso_id,
    )


# ============================================================
# RESPONSABLES / MÁQUINAS
# ============================================================

@app.get("/responsables")
def responsables(proceso_id: int = Query(...)):
    return _call_first_available(
        ["get_responsables", "get_responsables_proceso"],
        proceso_id,
    )


@app.get("/maquinas")
def maquinas(proceso_id: int = Query(...)):
    return _call_first_available(
        ["get_maquinas", "get_maquinas_proceso"],
        proceso_id,
    )


# ============================================================
# MUEBLES / ITEMS
# ============================================================

@app.get("/muebles-lote")
def muebles_lote(lote_id: int = Query(...)):
    return _call_first_available(
        ["get_muebles_lote"],
        lote_id,
    )


# ============================================================
# INVENTARIO / MATERIALES
# ============================================================

@app.get("/inventario")
def inventario(categoria: Optional[str] = Query(None)):
    return _call_first_available(
        ["get_inventario", "get_inventarios"],
        categoria,
    )


@app.get("/materiales-consumo")
def materiales_consumo(
    lote_id: int = Query(...),
    proceso_id: int = Query(...),
):
    return _call_first_available(
        ["get_materiales_consumo"],
        lote_id,
        proceso_id,
    )


@app.get("/materiales-consumo-detalle")
def materiales_consumo_detalle(
    lote_id: int = Query(...),
    proceso_id: int = Query(...),
):
    return _call_first_available(
        ["get_materiales_consumo_detalle", "obtener_materiales_consumo_detalle"],
        lote_id,
        proceso_id,
    )


@app.get("/consumos-acumulados")
def consumos_acumulados(lote_proceso_id: int = Query(...)):
    return _call_first_available(
        ["get_consumos_acumulados"],
        lote_proceso_id,
    )


@app.post("/consumo-parcial")
def consumo_parcial(request: ConsumoParcialRequest):
    return _call_first_available(
        ["registrar_consumo_parcial"],
        request.lote_proceso_id,
        request.material_id,
        request.cantidad_real,
        request.notas,
    )


# ============================================================
# PROCESO GENERAL
# ============================================================

@app.post("/actualizar-proceso")
def actualizar_proceso(request: ActualizarProcesoRequest):
    return _call_first_available(
        ["actualizar_proceso", "iniciar_lote_proceso"],
        **_body_dict(request, exclude_none=True),
    )


@app.post("/finalizar-proceso")
def finalizar_proceso(request: FinalizarProcesoRequest):
    return _call_first_available(
        ["finalizar_proceso", "finalizar_lote_proceso"],
        **_body_dict(request, exclude_none=True),
    )


# ============================================================
# TAREAS
# ============================================================

@app.get("/tareas-proceso")
def tareas_proceso(lote_proceso_id: int = Query(...)):
    return _call_first_available(
        ["get_tareas_proceso", "obtener_tareas_proceso"],
        lote_proceso_id,
    )


@app.post("/generar-tareas-proceso")
def generar_tareas_proceso(request: GenerarTareasProcesoRequest):
    """
    CORRECCIÓN IMPORTANTE:
    Se envía request.lote_proceso_id como argumento posicional.
    No usar lote_proceso_id=request.lote_proceso_id porque algunas versiones
    de sql_db.py no aceptan keyword arguments.
    """
    return _call_first_available(
        ["generar_tareas_proceso"],
        request.lote_proceso_id,
    )


@app.post("/actualizar-tarea-proceso")
def actualizar_tarea_proceso(request: ActualizarTareaProcesoRequest):
    return _call_first_available(
        ["actualizar_tarea_proceso", "actualizar_tarea"],
        **_body_dict(request, exclude_none=True),
    )


@app.post("/asignar-responsable-mueble")
def asignar_responsable_mueble(request: AsignarResponsableMuebleRequest):
    return _call_first_available(
        ["asignar_responsable_mueble"],
        **_body_dict(request, exclude_none=True),
    )


# ============================================================
# PIEZAS
# ============================================================

@app.get("/piezas")
def piezas():
    return _call_first_available(
        ["get_piezas"],
    )


@app.get("/piezas-mueble")
def piezas_mueble(
    lote_id: Optional[int] = Query(None),
    item_id: Optional[int] = Query(None),
):
    try:
        return _call_first_available(
            ["get_piezas_mueble"],
            lote_id=lote_id,
            item_id=item_id,
        )
    except HTTPException:
        if lote_id is not None and item_id is None:
            return _call_first_available(
                ["get_piezas_mueble"],
                lote_id,
            )
        raise


@app.post("/agregar-pieza-mueble")
def agregar_pieza_mueble(request: AgregarPiezaMuebleRequest):
    return _call_first_available(
        ["agregar_pieza_mueble"],
        **_body_dict(request, exclude_none=True),
    )


@app.post("/actualizar-llegada-pieza")
def actualizar_llegada_pieza(request: ActualizarLlegadaPiezaRequest):
    return _call_first_available(
        ["actualizar_llegada_pieza", "actualizar_llegada_pieza_mueble"],
        request.piezas_mueble_id,
        request.llegada,
    )


@app.post("/completar-piezas-mueble")
def completar_piezas_mueble(request: CompletarPiezasMuebleRequest):
    return _call_first_available(
        ["completar_piezas_mueble"],
        request.lote_id,
        request.items_proyecto_id,
    )


@app.post("/actualizar-pieza-mueble")
def actualizar_pieza_mueble(request: ActualizarPiezaMuebleRequest):
    payload = _body_dict(request, exclude_none=True)
    piezas_mueble_id = payload.pop("piezas_mueble_id")

    return _call_first_available(
        ["actualizar_pieza_mueble"],
        piezas_mueble_id,
        **payload,
    )


@app.post("/eliminar-pieza-mueble")
def eliminar_pieza_mueble(request: EliminarPiezaMuebleRequest):
    return _call_first_available(
        ["eliminar_pieza_mueble"],
        request.piezas_mueble_id,
    )


# ============================================================
# INSTALACIÓN / HERRAJES
# ============================================================

@app.get("/muebles-instalacion")
def muebles_instalacion(lote_proceso_id: int = Query(...)):
    return _call_first_available(
        ["get_muebles_instalacion", "obtener_muebles_instalacion"],
        lote_proceso_id,
    )


@app.post("/actualizar-llegada-herraje")
def actualizar_llegada_herraje(request: ActualizarLlegadaHerrajeRequest):
    return _call_first_available(
        ["actualizar_llegada_herraje"],
        request.lote_proceso_id,
        request.item_id,
        request.material_id,
        request.llegada,
        request.notas,
    )


@app.post("/sincronizar-herrajes-instalacion")
def sincronizar_herrajes_instalacion(request: SincronizarHerrajesRequest):
    return _call_first_available(
        ["sincronizar_herrajes_mueble_llegada", "sincronizar_herrajes_instalacion"],
        request.lote_proceso_id,
    )