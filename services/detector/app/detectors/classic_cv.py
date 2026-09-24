"""Detector de visión clásica (umbralización + componentes conexas).

Pendiente de implementar: requiere OpenCV y la foto de referencia (120 búfalas) para calibrar
parámetros y fijar la tolerancia del test. Hasta entonces responde con ``DetectorError``.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.domain.detector import DetectorError, DetectorOutput, InvalidParamsError


class ClassicCvParams(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    # Los animales miden 10-20 px en la imagen original.
    min_area_px: int = Field(40, ge=1)
    max_area_px: int = Field(900, ge=1)


class ClassicCvDetector:
    name = "classic-cv"
    version = "0.1.0"

    def resolve_params(self, params: dict[str, Any] | None) -> dict[str, Any]:
        try:
            return ClassicCvParams.model_validate(params or {}).model_dump()
        except ValidationError as exc:
            raise InvalidParamsError(str(exc)) from exc

    def detect(self, image: bytes, params: dict[str, Any]) -> DetectorOutput:
        raise DetectorError(f"{self.name}@{self.version} is not implemented yet")
