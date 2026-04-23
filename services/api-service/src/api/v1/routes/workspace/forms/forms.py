from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from src.db.database import get_db
from src.schemas.models import (
    CategoriesForms,
    ForeignKeyLookupResponse,
    SubmitForm,
    TableForms,
    SubmitFormResponse,
    User,
)
from src.services import forms
from src.services.shared import build_etag_response
from src.api.deps import get_current_user
from src.core.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


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


@router.post("/submit", response_model=SubmitFormResponse | None)
async def submit_form(
    submit_data: SubmitForm,
    current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        correlation_id = await forms_service.submit_form(
            submit_data,
            user_id=str(current_user.id),
        )
        return SubmitFormResponse(status="success", correlation_id=correlation_id)
    except forms.IdentifierValidationError as e:
        raise HTTPException(status_code=422, detail=e.detail)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=500, detail=str(e))
