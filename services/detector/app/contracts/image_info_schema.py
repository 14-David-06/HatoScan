# AUTO-GENERADO desde packages/contracts/schemas. No editar.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ImageInfo(BaseModel):
    """
    Dimensiones de la imagen original, en píxeles.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    width: int = Field(..., ge=1)
    height: int = Field(..., ge=1)
