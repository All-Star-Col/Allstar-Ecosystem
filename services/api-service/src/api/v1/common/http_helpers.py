"""
HTTP utilities - Common helper functions for request/response handling across API v1
"""

from uuid import uuid4
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError

from src.core.logging_config import get_logger
from src.schemas.models import DataViewerErrorResponse

logger = get_logger(__name__)


def resolve_request_id(request: Request) -> str:
    """
    resolve_request_id()
    Resolve X-Request-ID from request header or generate a new one
        - request: Request | incoming FastAPI request
    """
    incoming_request_id = request.headers.get("X-Request-ID")
    if incoming_request_id and incoming_request_id.strip():
        return incoming_request_id.strip()
    return str(uuid4())


def build_error_response(
    *,
    request_id: str,
    status_code: int,
    detail: str,
    code: str,
    extra: dict | None = None,
) -> JSONResponse:
    """
    build_error_response()
    Build standardized error response with request_id header
        - request_id: str | correlation ID
        - status_code: int | HTTP status code
        - detail: str | error message
        - code: str | error code
    """
    payload = DataViewerErrorResponse(
        request_id=request_id,
        detail=detail,
        code=code,
    )
    content = jsonable_encoder(payload)
    if extra:
        content.update(jsonable_encoder(extra))

    return JSONResponse(
        status_code=status_code,
        content=content,
        headers={"X-Request-ID": request_id},
    )


def get_validation_code(validation_error: ValidationError) -> str:
    """
    get_validation_code()
    Map Pydantic validation errors to standard error codes
        - validation_error: ValidationError | Pydantic validation error
    """
    for error in validation_error.errors():
        location = tuple(error.get("loc", ()))
        if "q" in location:
            return "INVALID_Q_LENGTH"
        if "limit" in location:
            return "LIMIT_EXCEEDED"
        if "operator" in location:
            return "UNSUPPORTED_OPERATOR"

        is_identifier_error = (
            "table_id" in location
            or "columns" in location
            or ("sort" in location and "column" in location)
            or ("filters" in location and "column" in location)
        )
        if is_identifier_error:
            return "INVALID_IDENTIFIER"

    return "INVALID_FILTER"


def format_validation_detail(validation_error: ValidationError) -> str:
    """
    format_validation_detail()
    Format Pydantic validation error into readable message
        - validation_error: ValidationError | Pydantic validation error
    """
    first_error = validation_error.errors()[0]
    location = ".".join(str(part) for part in first_error.get("loc", []))
    message = first_error.get("msg", "Validation error")
    return f"{location}: {message}" if location else message


def log_operation(
    *,
    request_id: str,
    username: str,
    table_id: str,
    query_time_ms: float,
    row_count: int,
    status_code: int,
) -> None:
    """
    log_operation()
    Log DataViewer operation metrics
        - request_id: str | correlation ID
        - username: str | authenticated user
        - table_id: str | table being queried
        - query_time_ms: float | execution time
        - row_count: int | number of rows
        - status_code: int | HTTP status code
    """
    logger.info(
        "data_viewer request_id=%s user=%s table_id=%s query_time_ms=%s row_count=%s status_code=%s",
        request_id,
        username,
        table_id,
        query_time_ms,
        row_count,
        status_code,
    )
