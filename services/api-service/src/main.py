from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.exc import SQLAlchemyError

from src.core.logging_config import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)

from src.api.v1.routes.login import login
from src.api.v1.routes.public import public
from src.api.v1.routes.register import register
from src.api.v1.routes.sheets import sheets
from src.api.v1.routes.sheets.inventory import inventory
from src.api.v1.routes.workspace import workspace
from src.api.v1.routes.workspace.carpentry import carpentry
from src.api.v1.routes.workspace.forms import forms
from src.api.v1.routes.workspace.data_viewer import data_viewer
from src.api.v1.routes.workspace.orders import orders
from src.api.v1.routes.workspace.users import users
from src.api.v1.routes.tablet import carpentry as tablet_carpentry
from src.api.v1.routes.tablet import production as tablet_production
from src.api.v1.routes.tablet import upholstery as tablet_upholstery
from src.core.config import settings
from src.core.scheduler import scheduler
from src.db.database import engine

app = FastAPI(title="AllStar Platform API")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.json()
    except Exception:
        body = None

    logger.error(
        "Request validation error path=%s method=%s body=%s errors=%s",
        request.url.path,
        request.method,
        body,
        exc.errors(),
    )

    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"detail": exc.errors(), "body": body}),
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.exception(
        "Database error path=%s method=%s error=%s",
        request.url.path,
        request.method,
        exc,
    )
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database temporarily unavailable",
            "code": "DATABASE_UNAVAILABLE",
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "Unhandled API error path=%s method=%s error=%s",
        request.url.path,
        request.method,
        exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "code": "INTERNAL_ERROR"},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"http://100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\.\d+\.\d+(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(login.router, prefix="/api/v1", tags=["Auth"])
app.include_router(register.router, prefix="/api/v1", tags=["Auth"])

app.include_router(public.router, prefix="/api/v1", tags=["Public"])

app.include_router(inventory.router, prefix="/api/v1/sheets/inventory", tags=["sheets"])
app.include_router(sheets.router, prefix="/api/v1/sheets", tags=["sheets"])

app.include_router(workspace.router, prefix="/api/v1", tags=["Workspace"])
app.include_router(orders.router, prefix="/api/v1/workspace/orders", tags=["Workspace"])
app.include_router(forms.router, prefix="/api/v1/workspace/forms", tags=["Workspace"])
app.include_router(
    data_viewer.router, prefix="/api/v1/workspace/data-viewer", tags=["Workspace"]
)
app.include_router(users.router, prefix="/api/v1/workspace/users", tags=["Workspace"])
app.include_router(carpentry.router, prefix="/api/v1/workspace/carpentry", tags=["Workspace"])
app.include_router(
    tablet_production.router,
    prefix="/api/v1/tablet/production",
    tags=["Tablet Production"],
)
app.include_router(
    tablet_carpentry.router,
    prefix="/api/v1/tablet/carpentry",
    tags=["Tablet Carpentry Production"],
)
app.include_router(
    tablet_upholstery.router,
    prefix="/api/v1/tablet/tapiceria",
    tags=["Tablet Upholstery"],
)


@app.on_event("startup")
async def startup():
    if engine is None:
        logger.warning("[Scheduler] No iniciado porque la base de datos no esta configurada")
        return
    if not scheduler.running:
        scheduler.start()
        logger.debug("[Scheduler] Iniciado - ejecutara /trigger/production cada 240 minutos")


@app.on_event("shutdown")
async def shutdown():
    if scheduler.running:
        scheduler.shutdown()
    if engine is not None:
        await engine.dispose()
    logger.info("[Scheduler] Detenido")
