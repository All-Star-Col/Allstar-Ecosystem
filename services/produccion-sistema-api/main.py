from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.excel_db import (
    ExcelError,
    actualizar_proceso,
    finalizar_proceso,
    get_health,
    get_inventario,
    get_lote_proceso,
    get_lotes,
    get_maquinas,
    get_materiales_consumo,
    get_procesos,
    get_proyectos,
    get_responsables,
)

from app.schemas import ActualizarProcesoRequest, FinalizarProcesoRequest


app = FastAPI(
    title="Producción Carpintería API Excel",
    version="0.2.0",
    description="API temporal conectada a Excel para seguimiento de producción en carpintería.",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def handle_error(exc: Exception):
    if isinstance(exc, ExcelError):
        raise HTTPException(status_code=400, detail=str(exc))

    raise HTTPException(status_code=500, detail=f"Error interno: {exc}")


@app.get("/")
def root():
    return {
        "ok": True,
        "mensaje": "API de producción conectada a Excel.",
        "version": "0.2.0",
    }


@app.get("/health")
def health():
    try:
        return get_health()
    except Exception as exc:
        handle_error(exc)


@app.get("/procesos")
def procesos(
    piso: int = Query(..., ge=1, le=2),
):
    try:
        return get_procesos(piso)
    except Exception as exc:
        handle_error(exc)


@app.get("/proyectos")
def proyectos(
    proceso_id: int = Query(..., ge=1),
):
    try:
        return get_proyectos(proceso_id)
    except Exception as exc:
        handle_error(exc)


@app.get("/lotes")
def lotes(
    proyecto_id: int = Query(..., ge=1),
    proceso_id: int = Query(..., ge=1),
):
    try:
        return get_lotes(
            proyecto_id=proyecto_id,
            proceso_id=proceso_id,
        )
    except Exception as exc:
        handle_error(exc)


@app.get("/lote-proceso/{lote_proceso_id}")
def lote_proceso(
    lote_proceso_id: int,
):
    try:
        return get_lote_proceso(lote_proceso_id)
    except Exception as exc:
        handle_error(exc)


@app.get("/responsables")
def responsables(
    proceso_id: int = Query(..., ge=1),
):
    try:
        return get_responsables(proceso_id)
    except Exception as exc:
        handle_error(exc)


@app.get("/maquinas")
def maquinas(
    proceso_id: int = Query(..., ge=1),
):
    try:
        return get_maquinas(proceso_id)
    except Exception as exc:
        handle_error(exc)


@app.get("/materiales-consumo")
def materiales_consumo(
    lote_id: int = Query(..., ge=1),
    proceso_id: int = Query(..., ge=1),
):
    try:
        return get_materiales_consumo(
            lote_id=lote_id,
            proceso_id=proceso_id,
        )
    except Exception as exc:
        handle_error(exc)


@app.get("/inventario")
def inventario(
    categoria: str | None = Query(default=None),
):
    try:
        return get_inventario(categoria)
    except Exception as exc:
        handle_error(exc)


@app.post("/actualizar-proceso")
def actualizar(
    payload: ActualizarProcesoRequest,
):
    try:
        return actualizar_proceso(payload.model_dump())
    except Exception as exc:
        handle_error(exc)


@app.post("/finalizar-proceso")
def finalizar(
    payload: FinalizarProcesoRequest,
):
    try:
        return finalizar_proceso(payload.model_dump())
    except Exception as exc:
        handle_error(exc)