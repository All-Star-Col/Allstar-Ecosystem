from fastapi import APIRouter, File, HTTPException, Depends, Query, Request, UploadFile
from pydantic import BaseModel
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
    commit_purchase_order_import,
    preview_purchase_order_import,
)
from src.services.shared import build_etag_response
from src.api.deps import get_current_user
from src.core.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


class BulkPurchaseOrderCommitRequest(BaseModel):
    rows: list[dict[str, Any]]
    create_missing: bool = True


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
