# AUTO-GENERADO desde packages/contracts/schemas. No editar.

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Detection(BaseModel):
    """
    Un animal detectado o marcado. Coordenadas en píxeles de la imagen original, origen arriba-izquierda. Para tipo 'caja', (x, y) es la esquina superior izquierda.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: str = Field(..., min_length=1)
    x: float = Field(..., ge=0.0)
    y: float = Field(..., ge=0.0)
    tipo: Literal['punto', 'caja']
    w: float | None = Field(None, gt=0.0)
    h: float | None = Field(None, gt=0.0)
    score: float | None = Field(None, ge=0.0, le=1.0)
    origen: Literal['modelo', 'humano']
    estado: Literal['activa', 'descartada']
