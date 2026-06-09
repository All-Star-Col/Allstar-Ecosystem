from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.schemas.tablet_production import (
    TabletProductionFinishRequest,
    TabletProductionUpdateRequest,
)
from src.services.carpentry.common import AppError, map_database_error
from src.services.tablet import production as production_service

router = APIRouter()


def _raise_mapped_error(exc: Exception) -> None:
    mapped = exc if isinstance(exc, AppError) else map_database_error(exc)
    raise HTTPException(
        status_code=mapped.status,
        detail={"message": mapped.message, "code": mapped.code},
    )


@router.get("/")
async def root() -> dict:
    return {
        "ok": True,
        "mensaje": "API de produccion para tablet conectada a Allstar.",
        "version": "1.0.0",
    }


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)) -> dict:
    try:
        return await production_service.get_health(db)
    except Exception as exc:
        _raise_mapped_error(exc)


@router.get("/procesos")
async def procesos(
    piso: int = Query(..., ge=1, le=2),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    try:
        return await production_service.get_procesos(db, piso)
    except Exception as exc:
        _raise_mapped_error(exc)


@router.get("/proyectos")
async def proyectos(
    proceso_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    try:
        return await production_service.get_proyectos(db, proceso_id)
    except Exception as exc:
        _raise_mapped_error(exc)


@router.get("/lotes")
async def lotes(
    proyecto_id: int = Query(..., ge=1),
    proceso_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    try:
        return await production_service.get_lotes(
            db,
            proyecto_id=proyecto_id,
            proceso_id=proceso_id,
        )
    except Exception as exc:
        _raise_mapped_error(exc)


@router.get("/lote-proceso/{lote_proceso_id}")
async def lote_proceso(
    lote_proceso_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        return await production_service.get_lote_proceso(db, lote_proceso_id)
    except Exception as exc:
        _raise_mapped_error(exc)


@router.get("/responsables")
async def responsables(
    proceso_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    try:
        return await production_service.get_responsables(db, proceso_id)
    except Exception as exc:
        _raise_mapped_error(exc)


@router.get("/maquinas")
async def maquinas(
    proceso_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    try:
        return await production_service.get_maquinas(db, proceso_id)
    except Exception as exc:
        _raise_mapped_error(exc)


@router.get("/materiales-consumo")
async def materiales_consumo(
    lote_id: int = Query(..., ge=1),
    proceso_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    try:
        return await production_service.get_materiales_consumo(
            db,
            lote_id=lote_id,
            proceso_id=proceso_id,
        )
    except Exception as exc:
        _raise_mapped_error(exc)


@router.get("/inventario")
async def inventario(
    categoria: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    try:
        return await production_service.get_inventario(db, categoria)
    except Exception as exc:
        _raise_mapped_error(exc)


@router.post("/actualizar-proceso")
async def actualizar_proceso(
    payload: TabletProductionUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        return await production_service.actualizar_proceso(db, payload.model_dump())
    except Exception as exc:
        _raise_mapped_error(exc)


@router.post("/finalizar-proceso")
async def finalizar_proceso(
    payload: TabletProductionFinishRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        return await production_service.finalizar_proceso(db, payload.model_dump())
    except Exception as exc:
        _raise_mapped_error(exc)
