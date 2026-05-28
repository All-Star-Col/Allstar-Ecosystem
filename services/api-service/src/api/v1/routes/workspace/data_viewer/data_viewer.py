import time

# _____________________________________________________________
#   Librerias externas

from fastapi import APIRouter, Body, Depends, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

# _____________________________________________________________
#   Componentes internos

from src.api.deps import get_current_user
from src.api.v1.common.http_helpers import (
    resolve_request_id,
    build_error_response,
    get_validation_code,
    format_validation_detail,
    log_operation,
)
from src.core.logging_config import get_logger
from src.db.database import get_db
from src.schemas.models import (
    DataViewerQueryRequest,
    DataViewerQueryResponse,
    DataViewerRowUpdateRequest,
    DataViewerRowUpdateResponse,
    DataViewerTable,
    User,
)
from src.services.data_viewer import DataViewerError, DataViewerService

logger = get_logger(__name__)
router = APIRouter()


def get_data_viewer_service(db: AsyncSession = Depends(get_db)) -> DataViewerService:
    """
    get_data_viewer_service()
    Dependency to inject DataViewerService with database session
        - db: AsyncSession | database session
    """
    return DataViewerService(db)


@router.get("/tables", response_model=list[DataViewerTable] | None)
async def get_data_viewer_tables(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    data_viewer_service: DataViewerService = Depends(get_data_viewer_service),
):
    """
    get_data_viewer_tables()
    Get list of available tables for DataViewer
        - request: Request | FastAPI request (for X-Request-ID header)
        - response: Response | FastAPI response (to set header)
        - current_user: User | authenticated user
        - data_viewer_service: DataViewerService | service instance
    """
    request_id = resolve_request_id(request)
    started_at = time.perf_counter()

    try:
        tables = await data_viewer_service.get_tables(user_id=str(current_user.id))
        response.headers["X-Request-ID"] = request_id
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id="-",
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=len(tables),
            status_code=200,
        )
        return tables
    except DataViewerError as error:
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id="-",
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=0,
            status_code=error.status_code,
        )
        return build_error_response(
            request_id=request_id,
            status_code=error.status_code,
            detail=error.detail,
            code=error.code,
        )
    except Exception as error:
        logger.exception("Unexpected error in DataViewer tables endpoint: %s", error)
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id="-",
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=0,
            status_code=500,
        )
        return build_error_response(
            request_id=request_id,
            status_code=500,
            detail="Internal server error",
            code="INTERNAL_ERROR",
        )


@router.post("/query", response_model=DataViewerQueryResponse | None)
async def query_data_viewer(
    request: Request,
    response: Response,
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    data_viewer_service: DataViewerService = Depends(get_data_viewer_service),
):
    """
    query_data_viewer()
    Execute paginated query against a configured table
        - request: Request | FastAPI request (for X-Request-ID header)
        - response: Response | FastAPI response (to set header)
        - payload: dict | raw request body
        - current_user: User | authenticated user
        - data_viewer_service: DataViewerService | service instance
    """
    request_id = resolve_request_id(request)
    started_at = time.perf_counter()

    try:
        query_request = DataViewerQueryRequest.model_validate(payload)
    except ValidationError as validation_error:
        code = get_validation_code(validation_error)
        detail = format_validation_detail(validation_error)
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=str(payload.get("table_id", "-")),
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=0,
            status_code=422,
        )
        return build_error_response(
            request_id=request_id,
            status_code=422,
            detail=detail,
            code=code,
        )

    try:
        query_response = await data_viewer_service.query(
            query_request,
            user_id=str(current_user.id),
        )
        response.headers["X-Request-ID"] = request_id
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=query_request.table_id,
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=len(query_response.rows),
            status_code=200,
        )
        return query_response
    except DataViewerError as error:
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=query_request.table_id,
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=0,
            status_code=error.status_code,
        )
        return build_error_response(
            request_id=request_id,
            status_code=error.status_code,
            detail=error.detail,
            code=error.code,
        )
    except Exception as error:
        logger.exception("Unexpected error in DataViewer query endpoint: %s", error)
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=query_request.table_id,
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=0,
            status_code=500,
        )
        return build_error_response(
            request_id=request_id,
            status_code=500,
            detail="Internal server error",
            code="INTERNAL_ERROR",
        )


@router.post("/export")
async def export_data_viewer(
    request: Request,
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    data_viewer_service: DataViewerService = Depends(get_data_viewer_service),
):
    """
    export_data_viewer()
    Export table data as CSV with same filtering/sorting options as query
        - request: Request | FastAPI request (for X-Request-ID header)
        - payload: dict | raw request body
        - current_user: User | authenticated user
        - data_viewer_service: DataViewerService | service instance
    """
    request_id = resolve_request_id(request)
    started_at = time.perf_counter()

    try:
        query_request = DataViewerQueryRequest.model_validate(payload)
    except ValidationError as validation_error:
        code = get_validation_code(validation_error)
        detail = format_validation_detail(validation_error)
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=str(payload.get("table_id", "-")),
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=0,
            status_code=422,
        )
        return build_error_response(
            request_id=request_id,
            status_code=422,
            detail=detail,
            code=code,
        )

    try:
        export_result = await data_viewer_service.export_csv(
            query_request,
            user_id=str(current_user.id),
        )
        streaming_response = StreamingResponse(
            export_result.stream,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{export_result.filename}"',
                "X-Request-ID": request_id,
            },
        )

        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=query_request.table_id,
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=export_result.row_count,
            status_code=200,
        )
        return streaming_response
    except DataViewerError as error:
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=query_request.table_id,
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=0,
            status_code=error.status_code,
        )
        return build_error_response(
            request_id=request_id,
            status_code=error.status_code,
            detail=error.detail,
            code=error.code,
        )
    except Exception as error:
        logger.exception("Unexpected error in DataViewer export endpoint: %s", error)
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=query_request.table_id,
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=0,
            status_code=500,
        )
        return build_error_response(
            request_id=request_id,
            status_code=500,
            detail="Internal server error",
            code="INTERNAL_ERROR",
        )


@router.patch("/rows", response_model=DataViewerRowUpdateResponse | None)
async def patch_data_viewer_row(
    request: Request,
    response: Response,
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    data_viewer_service: DataViewerService = Depends(get_data_viewer_service),
):
    """
    patch_data_viewer_row()
    Update one row using PK-based matching
        - request: Request | FastAPI request (for X-Request-ID header)
        - response: Response | FastAPI response (to set header)
        - payload: dict | raw request body
        - current_user: User | authenticated user
        - data_viewer_service: DataViewerService | service instance
    """
    request_id = resolve_request_id(request)
    started_at = time.perf_counter()

    try:
        patch_request = DataViewerRowUpdateRequest.model_validate(payload)
    except ValidationError as validation_error:
        detail = format_validation_detail(validation_error)
        first_error = validation_error.errors()[0]
        location = tuple(first_error.get("loc", ()))
        message = str(first_error.get("msg", "")).lower()

        if "table_id" in location:
            code = "INVALID_IDENTIFIER"
        elif "pk" in location and "identifier" not in message:
            code = "PK_REQUIRED"
        elif "identifier" in message:
            code = "INVALID_IDENTIFIER"
        else:
            code = "VALIDATION_ERROR"

        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=str(payload.get("table_id", "-")),
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=0,
            status_code=422,
        )
        return build_error_response(
            request_id=request_id,
            status_code=422,
            detail=detail,
            code=code,
        )

    try:
        patch_response = await data_viewer_service.patch_row(
            patch_request,
            user_id=str(current_user.id),
        )
        response.headers["X-Request-ID"] = request_id

        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=patch_request.table_id,
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=1,
            status_code=200,
        )
        return patch_response
    except DataViewerError as error:
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=patch_request.table_id,
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=0,
            status_code=error.status_code,
        )
        return build_error_response(
            request_id=request_id,
            status_code=error.status_code,
            detail=error.detail,
            code=error.code,
        )
    except Exception as error:
        logger.exception("Unexpected error in DataViewer patch endpoint: %s", error)
        log_operation(
            request_id=request_id,
            username=current_user.username,
            table_id=patch_request.table_id,
            query_time_ms=round((time.perf_counter() - started_at) * 1000, 2),
            row_count=0,
            status_code=500,
        )
        return build_error_response(
            request_id=request_id,
            status_code=500,
            detail="Internal server error",
            code="INTERNAL_ERROR",
        )
