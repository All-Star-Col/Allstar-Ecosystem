from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

# Importaciones de tu estructura
from src.api.deps import get_current_user, get_current_active_apps
from src.schemas.models import User, App
from src.core.logging_config import get_logger
logger = get_logger(__name__)

router = APIRouter()

@router.get("/workspace")
async def workspace(
    current_user: User = Depends(get_current_user),
    apps:List[App] = Depends(get_current_active_apps),
):
    return {
        "apps": apps,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "message": "You are authenticated ✅",
    }