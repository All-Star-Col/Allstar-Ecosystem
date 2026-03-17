from fastapi import APIRouter, Depends, HTTPException

from src.core.logging_config import get_logger
from src.services.sheets import SheetsService, get_sheets_service

logger = get_logger(__name__)

router = APIRouter()


@router.post('/trigger/production')
async def post_finishproduction(service: SheetsService = Depends(get_sheets_service)):
    try:
        status = await service.compare_coditems()
        if status == 200:
            return {status: success, message: Sincronizacioncompletada}
        if status == 404:
            raise HTTPException(
                status_code=404,
                detail=NoseencontrolahojaorecursodeGoogle,
            )
        raise HTTPException(
            status_code=500,
            detail=Errorinternoenelprocesodesincronizacion,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception(Errorejecutandotriggerdeproduccion)
        raise HTTPException(
            status_code=500,
            detail=Errorinternoenelprocesodesincronizacion,
        )
