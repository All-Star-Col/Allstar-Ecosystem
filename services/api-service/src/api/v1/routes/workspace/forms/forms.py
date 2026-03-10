from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from src.db.database import get_db
from src.schemas.models import (
    SubmitForm,
    CategoriesForms,
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
    _current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        data = await forms_service.get_tables()
        return build_etag_response(request, data)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submit", response_model=SubmitFormResponse | None)
async def submit_form(
    submit_data: SubmitForm,
    _current_user: User = Depends(get_current_user),
    forms_service: forms.FormsService = Depends(get_forms_service),
):
    try:
        correlation_id = await forms_service.submit_form(submit_data)
        return SubmitFormResponse(status="success", correlation_id=correlation_id)
    except forms.IdentifierValidationError as e:
        raise HTTPException(status_code=422, detail=e.detail)
    except forms.DBCommunicationError as e:
        raise HTTPException(status_code=500, detail=str(e))
