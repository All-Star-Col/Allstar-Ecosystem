from fastapi import APIRouter, File, HTTPException, Depends, Query, Request, UploadFile
from pydantic import BaseModel
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, List

from src.db.database import get_db, get_sqlserver_db
from src.schemas.models import (
    CategoriesForms,
    ForeignKeyLookupResponse,
    SubmitForm,
    TableForms,
    SubmitFormResponse,
    User,
)
from src.services import forms
from src.services.forms_bulk_upload import (
    commit_order_process_import,
    commit_purchase_order_import,
    preview_order_process_import,
    preview_purchase_order_import,
    revalidate_order_process_row,
    revalidate_purchase_order_product,
)
from src.services.shared import build_etag_response
from src.api.deps import get_current_user
from src.core.config import settings
from src.core.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


class BulkPurchaseOrderCommitRequest(BaseModel):
    rows: list[dict[str, Any]]
    create_missing: bool = True


class BulkPurchaseOrderRowRequest(BaseModel):
    row: dict[str, Any]


class BulkOrderProcessCommitRequest(BaseModel):
    rows: list[dict[str, Any]]


class BulkOrderProcessRowRequest(BaseModel):
    row: dict[str, Any]


class SalesAssistantEmailImportRequest(BaseModel):
    max_correos: int = 20


class ProductComposeRequest(BaseModel):
    base_id: int | None = None
    base_nombre: str = ""
    modelo_id: int | None = None
    modelo_nombre: str = ""
    referencia_id: int | None = None
    referencia_nombre: str = ""
    referencia_1_id: int | None = None
    referencia_1_nombre: str = ""
    referencia_2_id: int | None = None
    referencia_2_nombre: str = ""
    referencia_3_id: int | None = None
    referencia_3_nombre: str = ""
    tela_id: int | None = None
    tela_nombre: str = ""
    tela_referencia: str = ""
    unidad_medida_id: int | None = None
    precio: Decimal | None = None


class OrderProcessEntryRequest(BaseModel):
    process_id: int
    empleado_id: int | str | None = None
    fecha_inicio: str | None = None
    fecha_finalizado: str | None = None
    comentarios: str | None = None


class OrderProcessSubmitRequest(BaseModel):
    item_id: int
    processes: list[OrderProcessEntryRequest]


def ensure_sales_assistant_enabled() -> None:
    if not is_sales_assistant_enabled():
        raise HTTPException(
            status_code=404,
            detail="El asistente IA de órdenes de compra está deshabilitado.",
        )


def is_sales_assistant_enabled() -> bool:
    value = str(settings.SALES_ASSISTANT_ENABLED or "").strip().lower()
    return value in {"1", "true", "yes", "y", "on", "enabled"}


def get_forms_service(db: AsyncSession = Depends(get_db)) -> forms.FormsService:
    return forms.FormsService(db)


@router.get("/categories", response_model=List[CategoriesForms] | None)
async def get_categories_endpoint(
    request: Request,
    _current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        data = await forms_service.get_categories()
        return build_etag_response(request, data)
    
    except forms.DBCommunicationError as e:
        
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables", response_model=List[TableForms] | None)
async def get_tables_endpoint(
    request: Request,
    current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        data = await forms_service.get_tables(user_id=str(current_user.id))
        return build_etag_response(request, data)
    except forms.IdentifierValidationError as e:
        raise HTTPException(status_code=422, detail=e.detail)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables/{table_name}", response_model=TableForms | None)
async def get_table_endpoint(
    table_name: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        data = await forms_service.get_table(
            table_name,
            user_id=str(current_user.id),
        )
        return build_etag_response(request, data)
    except forms.IdentifierValidationError as e:
        raise HTTPException(status_code=422, detail=e.detail)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/lookups/{table_name}/{column_name}",
    response_model=ForeignKeyLookupResponse | None,
)
async def get_foreign_key_lookup_endpoint(
    table_name: str,
    column_name: str,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(
        default=forms.DEFAULT_LOOKUP_LIMIT,
        ge=1,
        le=forms.MAX_LOOKUP_LIMIT,
    ),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        return await forms_service.get_foreign_key_lookup(
            user_id=str(current_user.id),
            table_name=table_name,
            column_name=column_name,
            q=q,
            limit=limit,
            offset=offset,
        )
    except forms.IdentifierValidationError as e:
        raise HTTPException(status_code=422, detail=e.detail)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/column-values/{table_name}/{column_name}",
    response_model=ForeignKeyLookupResponse | None,
)
async def get_column_values_endpoint(
    table_name: str,
    column_name: str,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(
        default=forms.DEFAULT_LOOKUP_LIMIT,
        ge=1,
        le=forms.MAX_LOOKUP_LIMIT,
    ),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        return await forms_service.get_column_values(
            table_name=table_name,
            column_name=column_name,
            user_id=str(current_user.id),
            q=q,
            limit=limit,
            offset=offset,
        )
    except forms.IdentifierValidationError as e:
        raise HTTPException(status_code=422, detail=e.detail)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/product-composer/options/{part}")
async def get_product_composer_options_endpoint(
    part: str,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(
        default=forms.DEFAULT_LOOKUP_LIMIT,
        ge=1,
        le=forms.MAX_LOOKUP_LIMIT,
    ),
    offset: int = Query(default=0, ge=0),
    _current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        return await forms_service.get_product_composer_options(
            part=part,
            q=q,
            limit=limit,
            offset=offset,
        )
    except forms.IdentifierValidationError as e:
        raise HTTPException(status_code=422, detail=e.detail)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/product-composer/compose")
async def compose_product_endpoint(
    payload: ProductComposeRequest,
    _current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        return await forms_service.compose_product(**payload.model_dump())
    except forms.IdentifierValidationError as e:
        raise HTTPException(status_code=422, detail=e.detail)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/next-consecutive/{table_name}/{column_name}",
)
async def get_next_consecutive_endpoint(
    table_name: str,
    column_name: str,
    current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        return await forms_service.get_next_consecutive(
            table_name=table_name,
            column_name=column_name,
            user_id=str(current_user.id),
        )
    except forms.IdentifierValidationError as e:
        raise HTTPException(status_code=422, detail=e.detail)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unassigned-orders")
async def get_unassigned_orders_endpoint(
    table_name: str,
    order_column: str,
    client_column: str,
    legacy_column: str,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=forms.DEFAULT_LOOKUP_LIMIT, ge=1, le=forms.MAX_LOOKUP_LIMIT),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    sqlserver_conn: object = Depends(get_sqlserver_db),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        return await forms_service.get_unassigned_orders(
            table_name=table_name,
            order_column=order_column,
            client_column=client_column,
            legacy_column=legacy_column,
            user_id=str(current_user.id),
            q=q,
            limit=limit,
            offset=offset,
            sqlserver_conn=sqlserver_conn,
        )
    except forms.IdentifierValidationError as e:
        raise HTTPException(status_code=422, detail=e.detail)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/order-process/items")
async def get_order_process_items_endpoint(
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=forms.DEFAULT_LOOKUP_LIMIT, ge=1, le=forms.MAX_LOOKUP_LIMIT),
    offset: int = Query(default=0, ge=0),
    _current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        return await forms_service.get_order_process_items(
            q=q,
            limit=limit,
            offset=offset,
        )
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/order-process/processes")
async def get_order_process_options_endpoint(
    _current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        return await forms_service.get_order_process_options()
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/order-process/plan")
async def get_order_process_plan_endpoint(
    item_id: int = Query(..., ge=1),
    up_to_process: int = Query(..., ge=1, le=6),
    _current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        return await forms_service.get_order_process_plan(
            item_id=item_id,
            up_to_process=up_to_process,
        )
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/order-process/submit")
async def submit_order_process_endpoint(
    payload: OrderProcessSubmitRequest,
    _current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        return await forms_service.submit_order_process_form(
            item_id=payload.item_id,
            processes=[entry.model_dump() for entry in payload.processes],
        )
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/bulk/purchase-orders/preview")
async def preview_bulk_purchase_orders_endpoint(
    file: UploadFile = File(...),
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=422, detail="El archivo debe ser .xlsx")

    try:
        content = await file.read()
        return await preview_purchase_order_import(db, content)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Error previewing bulk purchase orders: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/bulk/purchase-orders/commit")
async def commit_bulk_purchase_orders_endpoint(
    payload: BulkPurchaseOrderCommitRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await commit_purchase_order_import(
            db,
            payload.rows,
            create_missing=payload.create_missing,
        )
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Error committing bulk purchase orders: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/bulk/purchase-orders/revalidate-product")
async def revalidate_bulk_purchase_order_product_endpoint(
    payload: BulkPurchaseOrderRowRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await revalidate_purchase_order_product(db, payload.row)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Error revalidating bulk purchase order product: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/bulk/order-process/preview")
async def preview_bulk_order_process_endpoint(
    file: UploadFile = File(...),
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=422, detail="El archivo debe ser .xlsx")

    try:
        content = await file.read()
        return await preview_order_process_import(db, content)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Error previewing bulk order process: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/bulk/order-process/revalidate-row")
async def revalidate_bulk_order_process_row_endpoint(
    payload: BulkOrderProcessRowRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await revalidate_order_process_row(db, payload.row)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Error revalidating bulk order process row: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/bulk/order-process/commit")
async def commit_bulk_order_process_endpoint(
    payload: BulkOrderProcessCommitRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await commit_order_process_import(db, payload.rows)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Error committing bulk order process: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/sales-assistant/status")
async def get_sales_assistant_status_endpoint(
    _current_user: User = Depends(get_current_user),
):
    return {"enabled": is_sales_assistant_enabled()}


@router.get("/sales-assistant/preorders")
async def list_sales_assistant_preorders_endpoint(
    limit: int = Query(default=50, ge=1, le=200),
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_sales_assistant_enabled()
    try:
        from src.services.sales_assistant import list_preorders

        return {"items": await list_preorders(db, limit=limit)}
    except Exception as e:
        logger.exception("Error listing sales assistant preorders: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/sales-assistant/import-email")
async def import_sales_assistant_email_endpoint(
    payload: SalesAssistantEmailImportRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_sales_assistant_enabled()
    try:
        from src.services.sales_assistant import (
            SalesAssistantConfigError,
            import_purchase_order_emails,
        )

        return await import_purchase_order_emails(
            db,
            max_emails=payload.max_correos,
        )
    except SalesAssistantConfigError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Error importing purchase order emails: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/sales-assistant/preorders/{preorder_id}/extract-ai")
async def extract_sales_assistant_preorder_ai_endpoint(
    preorder_id: int,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_sales_assistant_enabled()
    try:
        from src.services.sales_assistant import (
            SalesAssistantAIError,
            SalesAssistantConfigError,
            extract_purchase_order_ai,
        )

        return {
            "status": "success",
            "extraccion_ia": await extract_purchase_order_ai(
                db,
                preorder_id=preorder_id,
            ),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except SalesAssistantConfigError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except SalesAssistantAIError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("Error extracting preorder with AI: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/submit", response_model=SubmitFormResponse | None)
async def submit_form(
    submit_data: SubmitForm,
    request: Request,
    current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        logger.debug(
            "submit_form request path=%s user=%s table=%s data=%s",
            request.url.path,
            getattr(current_user, "id", None),
            getattr(submit_data, "table_name", None),
            [ {"column": d.column, "value": d.value} for d in submit_data.data ],
        )

        correlation_id = await forms_service.submit_form(
            submit_data,
            user_id=str(current_user.id),
        )
        return SubmitFormResponse(status="success", correlation_id=correlation_id)
    except forms.IdentifierValidationError as e:
        logger.warning(
            "IdentifierValidationError submitting form table=%s user=%s detail=%s",
            getattr(submit_data, "table_name", None),
            getattr(current_user, "id", None),
            e.detail,
        )
        raise HTTPException(status_code=422, detail=e.detail)
    except forms.DBCommunicationError as e:
        logger.exception(
            "DBCommunicationError inserting into %s user=%s data=%s: %s",
            getattr(submit_data, "table_name", None),
            getattr(current_user, "id", None),
            [ {"column": d.column, "value": d.value} for d in submit_data.data ],
            str(e),
        )
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception(
            "Unexpected error in submit_form user=%s table=%s data=%s: %s",
            getattr(current_user, "id", None),
            getattr(submit_data, "table_name", None),
            getattr(submit_data, "data", None),
            str(e),
        )
        raise HTTPException(status_code=500, detail="Internal Server Error")
