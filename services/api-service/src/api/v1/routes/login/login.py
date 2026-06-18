from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Importaciones de tu propia estructura
from src.core.config import settings
from src.core.auth import authenticate_user, create_access_token
from src.db.database import get_db
from src.schemas.models import Token
from src.services.users import update_login_time
from src.core.logging_config import get_logger

logger = get_logger(__name__)


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/login")

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
):

    user = await authenticate_user(db, form_data.username.strip(), form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    await update_login_time(db, user.username)

    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {"access_token": access_token, "token_type": "bearer"}
