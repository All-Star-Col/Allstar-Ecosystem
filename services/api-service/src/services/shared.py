import hashlib
import json
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse, Response
from fastapi.encoders import jsonable_encoder
from typing import Any

from src.core.logging_config import get_logger

logger = get_logger(__name__)


def build_etag_response(request: Request, data: Any) -> Response:
    """
    Generates an ETag for the given data.
    Returns 304 if If-None-Match matches.
    Otherwise returns JSONResponse with ETag header.
    """

    # Convert Pydantic models safely
    json_data = jsonable_encoder(data)

    content = json.dumps(json_data, sort_keys=True)
    etag = hashlib.md5(content.encode()).hexdigest()
    logger.info(f'${etag} and %{request.headers.get('if-none-match')}')
    if request.headers.get("if-none-match") == etag:
        logger.info('Recursos no modificados')
        return Response(status_code=304, headers={"ETag": etag})
    logger.info('Recursos fueron modificados')
    response = JSONResponse(content=json_data)
    response.headers["ETag"] = etag
    return response
