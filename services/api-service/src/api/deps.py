from typing import Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt

from src.core.auth import oauth2_scheme  # Suponiendo que está definido aquí
from src.db.database import get_db
from src.schemas.models import Role, User, App
from src.services.roles import get_role
from src.services.users import get_user  # O donde hayas pegado la función anterior
from src.services.apps import get_user_apps_from_db
from src.core.config import settings
from src.core.logging_config import get_logger

logger = get_logger(__name__)


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials, token may be invalid or expired",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await get_user(db, username)
    if user is None:
        raise credentials_exception
    if user.disabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return user


async def get_current_active_apps(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[App]:
    return await get_user_apps_from_db(db, str(current_user.id))


async def require_admin(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    role = await get_role(username=current_user.username, db=db)
    return current_user if (role is not None and role.code == "ADMIN") else None
