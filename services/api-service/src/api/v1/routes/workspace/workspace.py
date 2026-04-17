from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_active_apps, get_current_user
from src.db.database import get_db
from src.schemas.models import App, User
from src.services.roles import get_role

router = APIRouter()


@router.get("/workspace")
async def workspace(
    current_user: User = Depends(get_current_user),
    apps: List[App] = Depends(get_current_active_apps),
    db: AsyncSession = Depends(get_db),
):
    role = await get_role(db=db, username=current_user.username)

    return {
        "apps": apps,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role_code": role.code if role else None,
        "is_admin": bool(role is not None and role.code == "ADMIN"),
        "message": "You are authenticated",
    }
