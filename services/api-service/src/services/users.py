from jose import JWTError, jwt
from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


from src.db.database import get_db
from src.schemas.models import User, UserInDB, UserCreate
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
                    ON CONFLICT (username) DO NOTHING;
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

    if not r.rowcount:
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

    r = await db.execute(query, {"username": username})

    if not r.rowcount:
        raise HTTPException(status_code=409, detail="Username not finded")

    await db.commit()
