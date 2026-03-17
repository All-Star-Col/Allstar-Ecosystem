from fastapi import APIRouter, HTTPException, Depends
from typing import TypedDict, Tuple, List


from src.schemas.models import Item_LookupResponse, LocationItem, DispatchItem
from src.services.sheets import SheetsService, get_sheets_service
from src.core.logging_config import get_logger
logger = get_logger(__name__)

router = APIRouter()

@router.get("/get/{item}", response_model=Item_LookupResponse, response_model_exclude_none=True)
async def get_product(
    item: int,
    opt_request: bool = True,
    service: SheetsService = Depends(get_sheets_service)
):
    result = await service.get_item(item, opt_request=opt_request)

    if not result:
        raise HTTPException(status_code=404, detail="Item no encontrado.")

    # Narrowing por longitud
    if len(result) == 7:
        excel_row, prod, tela, bodega, fila, opt_wh, opt_row = result
        return {
            "item": item,
            "excel_row": excel_row,
            "product": prod,
            "fabric": tela,
            "warehouse": bodega,
            "warehouse_row": fila,
            "opt_warehouse": opt_wh,
            "opt_row": opt_row,
        }

    excel_row, prod, tela, bodega, fila = result
    return {
        "item": item,
        "excel_row": excel_row,
        "product": prod,
        "fabric": tela,
        "warehouse": bodega,
        "warehouse_row": fila,
    }


@router.post("/new/{item}")
async def post_product(item: int, service: SheetsService = Depends(get_sheets_service)):
    status = await service.new_item(item=item)

    if status == 404:
        raise HTTPException(status_code=404, detail=f"El item no existe en {service.SHEET_NAME_ACCES}")
    elif status == 409:
        raise HTTPException(status_code=409, detail="Ese Item ya existe en el inventario.")
    elif status != 200:
        raise HTTPException(status_code=500, detail="Error al agregar el item")
    return {"status": "OK"}

@router.patch("/location/{row}")
async def patch_location(row: int, location: LocationItem, service: SheetsService = Depends(get_sheets_service)):
    status = await service.update_location(row, location.new_warehouse, location.new_row, location.referral)

    if status != 200:
        raise HTTPException(status_code=500, detail="Error al actualizar la ubicación.")
    return {"status": "OK"}

@router.patch("/dispatch/{row}")
async def patch_dispatch(row: int, dispatch: DispatchItem, service: SheetsService = Depends(get_sheets_service)):
    status = await service.ship_product(row, dispatch.dispatch_date, dispatch.referral, dispatch.invoice)

    if status != 200:
        raise HTTPException(status_code=500, detail="Error al actualizar el despacho.")
    return {"status": "OK"}
