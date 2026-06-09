from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TabletProductionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    lote_proceso_id: int | None = Field(default=None)
    id: int | None = Field(default=None)
    responsable_id: int | None = Field(default=None)
    persona_id: int | None = Field(default=None)
    maquina_id: int | None = Field(default=None)
    fecha_inicio: str | None = Field(default=None)
    fecha_inicio_real: str | None = Field(default=None)
    comentario: str | None = Field(default=None)
    notas: str | None = Field(default=None)
    estado: str | None = Field(default=None)


class TabletProductionFinishRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    lote_proceso_id: int | None = Field(default=None)
    id: int | None = Field(default=None)
    lote_id: int | None = Field(default=None)
    proceso_id: int | None = Field(default=None)
    responsable_id: int | None = Field(default=None)
    persona_id: int | None = Field(default=None)
    maquina_id: int | None = Field(default=None)
    fecha_finalizado: str | None = Field(default=None)
    fecha_fin_real: str | None = Field(default=None)
    comentario: str | None = Field(default=None)
    notas: str | None = Field(default=None)
    materiales: list[dict[str, Any]] | None = Field(default=None)
