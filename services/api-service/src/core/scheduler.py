import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.core.logging_config import get_logger

scheduler = AsyncIOScheduler(
    job_defaults={
        "coalesce": True,
        "max_instances": 1,
        "misfire_grace_time": 60,
    }
)
logger = get_logger(__name__)


@scheduler.scheduled_job('interval', minutes=240)
async def consultar_y_procesar():
    '''Job programado: llama al endpoint /trigger/production cada 240 minutos.'''

    try:
        timeout = httpx.Timeout(10.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                'http://localhost:8000/api/v1/sheets/trigger/production'
            )
            logger.info('[Scheduler] Trigger ejecutado: %s', response.status_code)
    except Exception as e:
        logger.exception('[Scheduler] Error al ejecutar trigger: %s', e)
