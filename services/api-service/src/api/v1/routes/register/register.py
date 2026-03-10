
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.auth import create_access_token
from src.db.database import get_db
from src.schemas.models import Token, UserCreate
from src.services.users import create_user
from src.core.logging_config import get_logger
logger = get_logger(__name__)

router = APIRouter()

@router.post('/register', response_model=Token)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):

    await create_user(db, user)
    access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
    return {"access_token": access_token, "token_type": "bearer"}