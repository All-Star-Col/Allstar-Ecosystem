from apscheduler.schedulers.asyncio import AsyncIOScheduler
import httpx
from src.core.logging_config import get_logger

scheduler = AsyncIOScheduler()
logger = get_logger(__name__)


@scheduler.scheduled_job("interval", minutes=10)
async def consultar_y_procesar():
    """Job programado: llama al endpoint /trigger/production cada 10 minutos."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:8000/api/v1/sheets/trigger/production"
            )
            logger.info(f"[Scheduler] Trigger ejecutado: {response.status_code}")
    except Exception as e:
        logger.exception(f"[Scheduler] Error al ejecutar trigger: {e}")
