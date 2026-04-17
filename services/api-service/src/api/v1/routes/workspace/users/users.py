from uuid import UUID

from fastapi import APIRouter, Depends

from src.db.database import get_db
from src.schemas.models import User, UserAdminCreate, UserCreate, UserUpdate
from src.api.deps import require_admin
from src.services.users import (
    create_user,
    delete_user,
    get_user_by_id,
    list_users,
    update_user,
)
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/")
async def get_list(
    limit: int = 100,
    offset: int = 0,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not admin:
        return None

    users = await list_users(db, limit, offset)
    return {
        "list_users": users,
        "limit": limit,
        "offset": offset,
        "total": len(users),
    }


@router.get("/{user_id}")
async def get_by_id(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):

    return {"user": await get_user_by_id(db=db, id=user_id)} if admin else None


@router.post("/")
async def create(
    user: UserCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await create_user(db, user) if admin else None


@router.patch("/{user_id}")
async def update(
    user_id: UUID,
    user_info: UserUpdate | None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):

    if admin and user_info is not None:
        await update_user(db, user_info, user_id)


@router.delete("/{user_id}")
async def delete(
    user_id: UUID,
    hard: bool,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await delete_user(db, user_id, hard) if admin else None
