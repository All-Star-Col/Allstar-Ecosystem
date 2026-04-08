from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.db.database import get_db
from src.schemas.carpentry import ActionInvokeRequest, ActionInvokeResponse
from src.schemas.models import User
from src.services.carpentry.common import AppError, map_database_error
from src.services.carpentry.registry import execute_action, list_actions

router = APIRouter()


@router.get("/actions")
async def acciones_disponibles(_current_user: User = Depends(get_current_user)) -> dict:
    return {"actions": list_actions()}


@router.get("/ping")
async def ping(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> dict:
    try:
        data = await execute_action(db, "sistema.ping", {})
        return data
    except Exception as exc:
        mapped = map_database_error(exc)
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
        data = await execute_action(db, request.action, request.payload)
        return ActionInvokeResponse(
            action=request.action,
            data=data,
            request_ts=datetime.now(timezone.utc),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": str(exc), "code": "ACTION_NOT_FOUND"},
        )
    except AppError as exc:
        raise HTTPException(
            status_code=exc.status,
            detail={"message": exc.message, "code": exc.code},
        )
    except Exception as exc:
        mapped = map_database_error(exc)
        raise HTTPException(
            status_code=mapped.status,
            detail={"message": mapped.message, "code": mapped.code},
        )
