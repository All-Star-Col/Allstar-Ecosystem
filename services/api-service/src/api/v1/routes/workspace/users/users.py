from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from src.db.database import get_db
from src.schemas.models import (
    AssignUserRoleRequest,
    Role,
    RolePermissionsResponse,
    RolePermissionsUpdateRequest,
    User,
    UserCreate,
    UserRoleResponse,
    UserUpdate,
)
from src.api.deps import require_admin
from src.services.roles import (
    RoleNotFoundError,
    RoleTablesUnavailableError,
    RoleFormsUnavailableError,
    UserNotFoundError,
    assign_user_role,
    get_role_permissions,
    get_user_role_by_user_id,
    list_active_roles,
    upsert_role_permissions,
)
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


@router.get("/roles", response_model=list[Role] | None)
async def get_roles(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not admin:
        return None

    return await list_active_roles(db)


@router.get("/{user_id}/role", response_model=UserRoleResponse | None)
async def get_user_role(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not admin:
        return None

    try:
        role = await get_user_role_by_user_id(db=db, user_id=user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return UserRoleResponse(user_id=user_id, role=role)


@router.put("/{user_id}/role", response_model=UserRoleResponse | None)
async def put_user_role(
    user_id: UUID,
    payload: AssignUserRoleRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not admin:
        return None

    try:
        role = await assign_user_role(db=db, user_id=user_id, role_id=payload.role_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RoleNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return UserRoleResponse(user_id=user_id, role=role)


@router.get("/roles/{role_id}/permissions", response_model=RolePermissionsResponse | None)
async def get_permissions_by_role(
    role_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not admin:
        return None

    try:
        return await get_role_permissions(db=db, role_id=role_id)
    except RoleNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/roles/{role_id}/permissions", response_model=RolePermissionsResponse | None)
async def put_permissions_by_role(
    role_id: UUID,
    payload: RolePermissionsUpdateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not admin:
        return None

    try:
        return await upsert_role_permissions(db=db, role_id=role_id, data=payload)
    except RoleNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except (RoleTablesUnavailableError, RoleFormsUnavailableError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))


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
