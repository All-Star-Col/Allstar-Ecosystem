from datetime import datetime, timezone

from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.core.logging_config import get_logger
from src.db.database import get_db
from src.schemas.carpentry import ActionInvokeRequest, ActionInvokeResponse
from src.schemas.models import User
from src.services.carpentry.common import AppError, map_database_error
from src.services.carpentry import documentos as documentos_service
from src.services.carpentry.registry import execute_action, list_actions

router = APIRouter()
logger = get_logger(__name__)


@router.get("/actions")
async def acciones_disponibles(_current_user: User = Depends(get_current_user)) -> dict:
    return {"actions": list_actions()}


@router.get("/ping")
async def ping(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> dict:
    try:
        if db.in_transaction():
            await db.rollback()
        data = await execute_action(db, "sistema.ping", {})
        return data
    except Exception as exc:
        mapped = map_database_error(exc)
        logger.exception(
            "Error en carpinteria.ping | code=%s status=%s",
            mapped.code,
            mapped.status,
        )
        raise HTTPException(
            status_code=mapped.status,
            detail={"message": mapped.message, "code": mapped.code},
        )


@router.post("/invoke", response_model=ActionInvokeResponse)
async def invoke_action(
    request: ActionInvokeRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> ActionInvokeResponse:
    try:
        # Auth dependencies may leave an implicit transaction opened on the shared session.
        # Clear it so action handlers can manage their own transaction scope safely.
        if db.in_transaction():
            await db.rollback()
        data = await execute_action(db, request.action, request.payload)
        return ActionInvokeResponse(
            action=request.action,
            data=data,
            request_ts=datetime.now(timezone.utc),
        )
    except ValueError as exc:
        logger.exception("Accion no encontrada en carpinteria.invoke | action=%s", request.action)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": str(exc), "code": "ACTION_NOT_FOUND"},
        )
    except AppError as exc:
        logger.exception(
            "AppError en carpinteria.invoke | action=%s code=%s status=%s",
            request.action,
            exc.code,
            exc.status,
        )
        raise HTTPException(
            status_code=exc.status,
            detail={"message": exc.message, "code": exc.code},
        )
    except Exception as exc:
        mapped = map_database_error(exc)
        logger.exception(
            "Error inesperado en carpinteria.invoke | action=%s code=%s status=%s payload_keys=%s",
            request.action,
            mapped.code,
            mapped.status,
            sorted(list((request.payload or {}).keys())),
        )
        raise HTTPException(
            status_code=mapped.status,
            detail={"message": mapped.message, "code": mapped.code},
        )


@router.post("/documents/upload")
async def upload_document(
    proyecto_id: int = Form(...),
    proyecto_etapa_id: int | None = Form(None),
    etapa_id: int | None = Form(None),
    titulo: str | None = Form(None),
    descripcion: str | None = Form(None),
    archivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        if db.in_transaction():
            await db.rollback()
        file_bytes = await archivo.read()
        return await documentos_service.subir_documento(
            db,
            proyecto_id=proyecto_id,
            proyecto_etapa_id=proyecto_etapa_id,
            etapa_id=etapa_id,
            titulo=titulo,
            descripcion=descripcion,
            filename=archivo.filename or "documento",
            content_type=archivo.content_type,
            file_bytes=file_bytes,
            usuario=current_user.username,
        )
    except AppError as exc:
        logger.exception(
            "AppError subiendo documento de carpinteria | code=%s status=%s",
            exc.code,
            exc.status,
        )
        raise HTTPException(
            status_code=exc.status,
            detail={"message": exc.message, "code": exc.code},
        )
    except Exception as exc:
        mapped = map_database_error(exc)
        logger.exception(
            "Error inesperado subiendo documento de carpinteria | code=%s status=%s",
            mapped.code,
            mapped.status,
        )
        raise HTTPException(
            status_code=mapped.status,
            detail={"message": mapped.message, "code": mapped.code},
        )


@router.get("/documents/{document_id}/file")
async def download_document(
    document_id: int,
    disposition: str = Query("inline", pattern="^(inline|attachment)$"),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    try:
        if db.in_transaction():
            await db.rollback()
        file_bytes, filename, content_type = await documentos_service.descargar_documento(db, document_id)
        return StreamingResponse(
            BytesIO(file_bytes),
            media_type=content_type,
            headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
        )
    except AppError as exc:
        logger.exception(
            "AppError descargando documento de carpinteria | code=%s status=%s",
            exc.code,
            exc.status,
        )
        raise HTTPException(
            status_code=exc.status,
            detail={"message": exc.message, "code": exc.code},
        )
    except Exception as exc:
        mapped = map_database_error(exc)
        logger.exception(
            "Error inesperado descargando documento de carpinteria | code=%s status=%s",
            mapped.code,
            mapped.status,
        )
        raise HTTPException(
            status_code=mapped.status,
            detail={"message": mapped.message, "code": mapped.code},
        )
