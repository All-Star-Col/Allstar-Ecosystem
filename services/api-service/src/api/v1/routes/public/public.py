from fastapi import APIRouter
from src.core.logging_config import get_logger
logger = get_logger(__name__)

router = APIRouter()

@router.get("/public")
async def public():
    return {"message": "Anyone can see this 👀"}