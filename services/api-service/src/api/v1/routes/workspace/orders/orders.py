from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.auth import authenticate_user, create_access_token
from src.db.database import get_db
from src.schemas.models import Order

router = APIRouter()


@router.post('/orders')
async def post_order(order: Annotated[Order, None] , db : AsyncSession = Depends(get_db)):
    return order