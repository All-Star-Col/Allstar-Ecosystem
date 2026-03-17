from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.db.database import get_db
from src.schemas.models import Order, User

router = APIRouter()


@router.post('/orders', response_model=Order)
async def post_order(
    order: Order,
    _current_user: User = Depends(get_current_user),
    _db: AsyncSession = Depends(get_db),
):
    return order
