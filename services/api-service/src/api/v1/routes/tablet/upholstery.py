from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.services.tablet import upholstery as upholstery_service

router = APIRouter()


def _raise_error(exc: Exception) -> None:
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=400, detail=str(exc))
    raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/empleados")
async def empleados(db: AsyncSession = Depends(get_db)) -> list[dict]:
    try:
        return await upholstery_service.get_empleados(db)
    except Exception as exc:
        _raise_error(exc)


@router.get("/api/procesos")
async def procesos(db: AsyncSession = Depends(get_db)) -> list[dict]:
    try:
        return await upholstery_service.get_procesos(db)
    except Exception as exc:
        _raise_error(exc)


@router.get("/api/materiales")
async def materiales(db: AsyncSession = Depends(get_db)) -> list[dict]:
    try:
        return await upholstery_service.get_materiales(db)
    except Exception as exc:
        _raise_error(exc)


@router.get("/api/telas")
async def telas(db: AsyncSession = Depends(get_db)) -> list[dict]:
    try:
        return await upholstery_service.get_telas(db)
    except Exception as exc:
        _raise_error(exc)


@router.get("/api/ordenes/pendientes/{proceso_id}")
async def pendientes(
    proceso_id: int = Path(..., ge=1, le=5),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    try:
        return await upholstery_service.get_pendientes(db, proceso_id)
    except Exception as exc:
        _raise_error(exc)


@router.get("/api/ordenes/en-proceso/{proceso_id}")
async def en_proceso(
    proceso_id: int = Path(..., ge=1, le=5),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    try:
        return await upholstery_service.get_en_proceso(db, proceso_id)
    except Exception as exc:
        _raise_error(exc)


@router.post("/api/proceso/asignar")
async def asignar_proceso(
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        return await upholstery_service.asignar_proceso(db, payload)
    except Exception as exc:
        await db.rollback()
        _raise_error(exc)


@router.post("/api/proceso/finalizar")
async def finalizar_proceso(
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        return await upholstery_service.finalizar_proceso(db, payload)
    except Exception as exc:
        await db.rollback()
        _raise_error(exc)


@router.post("/api/consumo-material/registrar")
async def registrar_consumo_material(
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        return await upholstery_service.registrar_consumo_material(db, payload)
    except Exception as exc:
        await db.rollback()
        _raise_error(exc)


@router.post("/api/consumo-tela/registrar")
async def registrar_consumo_tela(
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        return await upholstery_service.registrar_consumo_tela(db, payload)
    except Exception as exc:
        await db.rollback()
        _raise_error(exc)
