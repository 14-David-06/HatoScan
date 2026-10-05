"""Detector YOLO + SAHI (inferencia por teselas). Futuro: stub para fijar la interfaz."""

from __future__ import annotations

from typing import Any

from app.domain.detector import DetectorError, DetectorOutput


class YoloSahiDetector:
    name = "yolo-sahi"
    version = "0.0.0"
    label = "YOLO + SAHI"
    description = "Modelo entrenado con las revisiones propias. Disponible cuando haya pesos."
    available = False

    def resolve_params(self, params: dict[str, Any] | None) -> dict[str, Any]:
        return dict(params or {})

    def detect(self, image: bytes, params: dict[str, Any]) -> DetectorOutput:
        raise DetectorError(f"{self.name} is not available yet")
