# AUTO-GENERADO desde packages/contracts/schemas. No editar.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class DetectorInfo(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    name: str = Field(..., pattern='^[a-z0-9][a-z0-9-]*$')
    version: str = Field(..., pattern='^[0-9]+[.][0-9]+[.][0-9]+$')
    label: str = Field(..., description='Nombre corto para la UI.', min_length=1)
    description: str = Field(
        ..., description='Para qué sirve y cuándo elegirlo. Texto para la UI.'
    )
    available: bool = Field(
        ...,
        description='false si el método está declarado pero todavía no se puede ejecutar.',
    )


class DetectorCatalog(BaseModel):
    """
    Métodos de detección que ofrece el servicio. La web los muestra para que la persona elija.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    default_detector: str = Field(
        ...,
        description='Nombre del detector que se usa si la petición no indica uno.',
        min_length=1,
    )
    detectors: list[DetectorInfo]
