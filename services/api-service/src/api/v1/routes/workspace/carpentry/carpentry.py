from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.core.logging_config import get_logger
from src.db.database import get_db
from src.schemas.carpentry import ActionInvokeRequest, ActionInvokeResponse
from src.schemas.models import User
from src.services.carpentry.common import AppError, map_database_error
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
