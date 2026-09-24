# AUTO-GENERADO desde packages/contracts/schemas. No editar.

from __future__ import annotations

from typing import Any

from pydantic import AnyUrl, BaseModel, ConfigDict, Field


class DetectRequest(BaseModel):
    """
    Petición al servicio de detección. La imagen se entrega por URL firmada (nunca se sube a través de Vercel).
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    conteo_id: str = Field(..., pattern='^SIRIUS-CONTEO-[0-9]{4,}$')
    image_url: AnyUrl
    detector: str | None = Field(
        None,
        description='Nombre del detector a usar. Si se omite, el servicio usa su detector por defecto.',
        min_length=1,
    )
    params: dict[str, Any] | None = Field(
        None,
        description='Parámetros específicos del detector. Se validan dentro del servicio.',
    )
