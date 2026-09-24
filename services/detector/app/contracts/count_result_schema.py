# AUTO-GENERADO desde packages/contracts/schemas. No editar.

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from . import detection_schema, image_info_schema


class CountResult(BaseModel):
    """
    Salida del detector para un conteo. Es la propuesta del modelo; nunca es el dato oficial.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    conteo_id: str = Field(..., pattern='^SIRIUS-CONTEO-[0-9]{4,}$')
    detector_version: str = Field(
        ...,
        description="Nombre y versión semántica, ej. 'classic-cv@1.0.0'.",
        pattern='^[a-z0-9][a-z0-9-]*@[0-9]+[.][0-9]+[.][0-9]+$',
    )
    params: dict[str, Any]
    params_hash: str = Field(
        ...,
        description='SHA-256 (hex) del JSON canónico de params.',
        pattern='^[a-f0-9]{64}$',
    )
    image: image_info_schema.ImageInfo
    detections: list[detection_schema.Detection]
    total: int = Field(..., description='Número de detecciones activas.', ge=0)
    processing_ms: int | None = Field(None, ge=0)
