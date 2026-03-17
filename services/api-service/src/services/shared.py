import hashlib
import json
from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, Response

from src.core.logging_config import get_logger

logger = get_logger(__name__)


def build_etag_response(request: Request, data: Any) -> Response:
    '''Generates an ETag for the given data.

    Returns 304 if If-None-Match matches.
    Otherwise returns JSONResponse with ETag header.
    '''

    json_data = jsonable_encoder(data)
    content = json.dumps(json_data, sort_keys=True, separators=(',', ':'))
    etag = hashlib.sha256(content.encode('utf-8')).hexdigest()

    if_none_match = request.headers.get('if-none-match')
    logger.debug('etag=%s if-none-match=%s', etag, if_none_match)

    if if_none_match == etag:
        logger.info('Recursos no modificados')
        return Response(status_code=304, headers={'ETag': etag})

    logger.info('Recursos fueron modificados')
    response = JSONResponse(content=json_data)
    response.headers['ETag'] = etag
    return response
