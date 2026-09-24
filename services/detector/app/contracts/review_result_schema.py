# AUTO-GENERADO desde packages/contracts/schemas. No editar.

from __future__ import annotations

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from . import detection_schema, image_info_schema


class ReviewResult(BaseModel):
    """
    Detecciones confirmadas por un revisor humano. Es el dato oficial y la fuente del dataset de entrenamiento.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    conteo_id: str = Field(..., pattern='^SIRIUS-CONTEO-[0-9]{4,}$')
    reviewer_id: str = Field(..., pattern='^SIRIUS-PER-[0-9]{4,}$')
    reviewed_at: AwareDatetime
    source_detector_version: str
    image: image_info_schema.ImageInfo
    detections: list[detection_schema.Detection] = Field(
        ..., description='Incluye las descartadas (negativos para entrenamiento).'
    )
    total: int = Field(..., description='Número de detecciones activas.', ge=0)
