from fastapi import APIRouter
from fastapi.responses import JSONResponse

from src.core.logging_config import get_logger
from src.db.database import check_database

logger = get_logger(__name__)

router = APIRouter()


@router.get("/public")
async def public():
    return {"message": "Anyone can see this"}


@router.get("/health/live")
async def health_live():
    return {"status": "ok"}


@router.get("/health/ready")
async def health_ready():
    try:
        await check_database()
    except Exception:
        logger.exception("Readiness healthcheck failed")
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": "unavailable"},
        )

    return {"status": "ok", "database": "ok"}
