from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession


from src.schemas.models import Item_LookupResponse, LocationItem, DispatchItem, Returned_Item
from src.db.database import get_db
from src.services.sheets import SheetsService, get_sheets_service
from src.core.logging_config import get_logger
logger = get_logger(__name__)

router = APIRouter()

#___________________________________________________________
#   GET | Endpoints
#___________________________________________________________

@router.get("/get/{item}", response_model=Item_LookupResponse)
async def get_product(item: int, service: SheetsService = Depends(get_sheets_service)):
    """
    get_product()
    Retorna los datos de un item en INVENTARIO junto con las listas de opciones de ubicacion.
        - item:int | codigo del item a buscar
    """
    result = await service.get_item(item)

    if not result:
        raise HTTPException(status_code=404, detail="Item no encontrado.")

    excel_row, prod, tela, ubicacion, fila, opt_wh, opt_row, opt_conveyor = result
    return {
        "item": item,
        "excel_row": excel_row,
        "product": prod,
        "fabric": tela,
        "warehouse": ubicacion,
        "warehouse_row": fila,
        "opt_warehouse": opt_wh,
        "opt_row": opt_row,
        "opt_conveyor": opt_conveyor,
    }

@router.get("/return_product/get_unknows", response_model=List[Returned_Item])
async def get_unknown_returns(service: SheetsService = Depends(get_sheets_service)):
    """
    get_unknown_returns()
    Retorna lista de items en DEVOLUCIONES con Estado 'Por revisar y asignar item'.
    """
    result = await service.get_unknown_returns()

    if result is None:
        raise HTTPException(status_code=500, detail="Error al leer DEVOLUCIONES.")
    
    return result

@router.get("/return_product/get/{item}", response_model=Returned_Item)
async def get_return_item(item: str, service: SheetsService = Depends(get_sheets_service)):
    """
    get_return_item()
    Busca un item en DEVOLUCIONES por col A y retorna sus datos basicos.
        - item:str | valor a buscar en col A de DEVOLUCIONES
    """
    result = await service.get_return_item(item)

    if result is None:
        raise HTTPException(status_code=404, detail="Item no encontrado en DEVOLUCIONES.")
    
    return result

#___________________________________________________________
#   POST | Endpoints
#___________________________________________________________

@router.post("/new/{item}")
async def post_product(
    item: int,
    service: SheetsService = Depends(get_sheets_service),
    db: AsyncSession = Depends(get_db),
):
    """
    post_product()
    Agrega un nuevo item a INVENTARIO consultando su informacion desde allstar_db.
        - item:int | codigo del item a agregar
    """
    status = await service.new_item(item=item, db=db)

    if status == 404:
        raise HTTPException(status_code=404, detail="El item no existe en el sistema.")
    elif status == 409:
        raise HTTPException(status_code=409, detail="Ese Item ya existe en el inventario.")
    elif status != 200:
        raise HTTPException(status_code=500, detail="Error al agregar el item")
    
    return {"status": "OK"}

@router.post("/return_product/{item}")
async def post_return_product(
    item: str,
    new_item: Optional[str] = Query(default=None),
    service: SheetsService = Depends(get_sheets_service)
):
    """
    post_return_product()
    Procesa la devolucion de un item: lo mueve de DEVOLUCIONES a INVENTARIO.
        - item:str     | item a procesar en DEVOLUCIONES (puede ser 'DESCONOCIDO...')
        - new_item:str | item destino en INVENTARIO (requerido si item es DESCONOCIDO)
    """
    if item.upper().startswith("DESCONOCIDO") and not new_item:
        raise HTTPException(status_code=422, detail="Se requiere new_item para items DESCONOCIDO.")
    
    resolved_new_item = new_item if new_item else item

    status = await service.return_product(item, resolved_new_item)

    if status == 404:
        raise HTTPException(status_code=404, detail="Item no encontrado en DEVOLUCIONES.")
    if status == 409:
        raise HTTPException(status_code=409, detail="Ese Item ya existe en el inventario.")
    if status != 200:
        raise HTTPException(status_code=500, detail="Error procesando la devolucion.")
    
    return {"status": "OK"}

#___________________________________________________________
#   PATCH | Endpoints
#___________________________________________________________

@router.patch("/location/{row}")
async def patch_location(row: int, location: LocationItem, service: SheetsService = Depends(get_sheets_service)):
    """
    patch_location()
    Actualiza la ubicacion de un item en INVENTARIO.
        - row:int          | numero de fila del item en la hoja
        - location:LocationItem | nuevos valores de UBICACION, FILA y OBSERVACIONES opcional
    """
    status = await service.update_location(row, location.new_warehouse, location.new_row, location.referral)

    if status == 404:
        raise HTTPException(status_code=404, detail="No se pudo conectar al servicio de Google Sheets.")
    if status != 200:
        raise HTTPException(status_code=500, detail="Error al actualizar la ubicación.")

    return {"status": "OK"}

@router.patch("/dispatch/{row}")
async def patch_dispatch(row: int, dispatch: DispatchItem, service: SheetsService = Depends(get_sheets_service)):
    """
    patch_dispatch()
    Mueve un item de INVENTARIO a DESPACHADO y elimina la fila original.
        - row:int          | numero de fila del item en INVENTARIO
        - dispatch:DispatchItem | datos de despacho: fecha, remision, factura, transportador
    """
    status = await service.ship_product(row, dispatch.dispatch_date, dispatch.referral, dispatch.invoice, dispatch.conveyor)

    if status == 404:
        raise HTTPException(status_code=404, detail="No se pudo conectar al servicio de Google Sheets.")
    if status != 200:
        raise HTTPException(status_code=500, detail="Error al actualizar el despacho.")

    return {"status": "OK"}

#___________________________________________________________
