from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ActionInvokeRequest(BaseModel):
    action: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)


class ActionInvokeResponse(BaseModel):
    action: str
    data: dict[str, Any] | list[dict[str, Any]] | list[Any] | str | int | float | bool | None
    request_ts: datetime
