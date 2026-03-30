from uuid import UUID

from jose import JWTError, jwt
from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


from src.db.database import get_db
from src.schemas.models import User, UserAdminResponse, UserInDB, UserCreate, UserUpdate
from src.core.security import get_password_hash
from src.core.logging_config import get_logger

logger = get_logger(__name__)


async def get_user(db: AsyncSession, username: str) -> Optional[UserInDB]:
    q = text(
        """
        SELECT id, username, full_name, password_hash, is_active
        FROM auth.users
        WHERE username = :username
        LIMIT 1
    """
    )
    r = await db.execute(q, {"username": username})
    row = r.mappings().first()
    if not row:
        return None

    return UserInDB(
        id=row["id"],
        username=row["username"],
        full_name=row["full_name"],
        password_hash=row["password_hash"],
        disabled=(not row["is_active"]),
    )


async def create_user(db: AsyncSession, data: UserCreate) -> None:
    password_hash = get_password_hash(data.password)
    query = text(
        """
                INSERT INTO auth.users (
                    email, username, full_name, password_hash,
                    is_active, is_email_verified, last_login_at,
                    created_at, updated_at)
                    VALUES(
                    :email , :username, :full_name, :password_hash,
                    true, false, NOW(), NOW(), NOW())
                    ON CONFLICT (username) DO NOTHING
                    RETURNING id;
    """
    )
    r = await db.execute(
        query,
        {
            "email": data.email,
            "username": data.username,
            "full_name": data.full_name,
            "password_hash": (password_hash),
        },
    )

    created_user_id = r.scalar_one_or_none()
    if created_user_id is None:
        raise HTTPException(status_code=409, detail="Username already exists")

    await db.commit()


async def update_login_time(db: AsyncSession, username: str) -> None:
    query = text(
        """
        UPDATE auth.users
        SET last_login_at = NOW()
        WHERE username = :username
    """
    )

    await db.execute(query, {"username": username})
    await db.commit()


async def get_user_by_id(db: AsyncSession, id: UUID) -> Optional[UserAdminResponse]:
    q = text(
        """
        SELECT id, username, full_name, is_active, is_email_verified
        FROM auth.users
        WHERE id = :id
        LIMIT 1
        """
    )

    r = await db.execute(q, {"id": id})
    row = r.mappings().first()
    if not row:
        return None

    return UserAdminResponse(
        id=row["id"],
        username=row["username"],
        full_name=row["full_name"],
        is_active=row["is_active"],
        is_email_verified=row["is_email_verified"],
    )


async def list_users(
    db: AsyncSession, limit: int, offset: int
) -> Optional[tuple[list[UserAdminResponse], int]]:

    q = text(
        """
        SELECT id, username, full_name, email, is_active, is_email_verified
        FROM auth.users LIMIT :limit OFFSET :offset
        """
    )

    r = await db.execute(q, {"limit": limit, "offset": offset})
    rows = r.mappings()
    if not rows:
        return None

    return (
        [
            UserAdminResponse(
                id=row["id"],
                username=row["username"],
                full_name=row["full_name"],
                is_active=row["is_active"],
                is_email_verified=row["is_email_verified"],
            )
            for row in rows
        ],
        limit,
    )


async def update_user(db: AsyncSession, data: UserUpdate, user_id: UUID) -> None:

    q_values = [str(value) + ":" + str(value) for value in data.model_fields_set]

    query = f"UPDATE auth.users SET {", ".join(q_values)} WHERE id = :id"
    q = text(query)

    await db.execute(
        q,
        {"id": (user_id)},
    )
    await db.commit()


async def delete_user(db: AsyncSession, user_id: UUID, hard: bool = False) -> None:

    if hard:
        q = text(
            """
            SELECT FROM auth.users
            WHERE id = :id
            """
        )
        await db.execute(q, {"id": user_id})
        await db.commit()

        return None

    q = text(
        """
        UPDATE auth.users
        SET is_active = false
        WHERE id = :id
        """
    )

    await db.execute(q, {"user_id": user_id})
    await db.commit()
