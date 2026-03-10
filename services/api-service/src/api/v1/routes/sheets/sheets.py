from fastapi import APIRouter, HTTPException, Depends
from typing import List

from src.schemas.models import Item_LookupResponse, LocationItem, DispatchItem
from src.services.sheets import SheetsService, get_sheets_service
from src.core.logging_config import get_logger
logger = get_logger(__name__)

router = APIRouter()

@router.post("/trigger/production")
async def post_finishproduction(service: SheetsService = Depends(get_sheets_service)):
    try:
        status = await service.compare_coditems()
        if status == 200:
            return {"status": "success", "message": "Sincronización completada"}
        elif status == 404:
            raise HTTPException(status_code=404, detail="No se encontró la hoja o recurso de Google")
        else:
            raise HTTPException(status_code=500, detail="Error interno en el proceso de sincronización")
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
