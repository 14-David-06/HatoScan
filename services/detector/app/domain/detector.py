"""Puerto del detector. El resto del servicio no conoce OpenCV, YOLO ni ningún proveedor."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

DetectionKind = Literal["punto", "caja"]


@dataclass(frozen=True, slots=True)
class RawDetection:
    """Detección en píxeles de la imagen original, origen arriba-izquierda.

    Para ``caja``, (x, y) es la esquina superior izquierda.
    """

    x: float
    y: float
    kind: DetectionKind
    w: float | None = None
    h: float | None = None
    score: float | None = None


@dataclass(frozen=True, slots=True)
class DetectorOutput:
    width: int
    height: int
    detections: list[RawDetection] = field(default_factory=list)


class DetectorError(Exception):
    """Fallo al detectar. Nunca se oculta: el conteo debe quedar en ``error``."""


class InvalidParamsError(DetectorError):
    """Parámetros no válidos para este detector."""


class Detector(Protocol):
    @property
    def name(self) -> str:
        """Nombre estable del detector, ej. ``classic-cv``."""
        ...

    @property
    def version(self) -> str:
        """Versión semántica ``MAJOR.MINOR.PATCH``."""
        ...

    def resolve_params(self, params: dict[str, Any] | None) -> dict[str, Any]:
        """Valida los parámetros y devuelve el conjunto completo (con valores por defecto)."""
        ...

    def detect(self, image: bytes, params: dict[str, Any]) -> DetectorOutput:
        """Detecta sobre la imagen a resolución completa. Nunca reducir la resolución."""
        ...


def params_hash(params: dict[str, Any]) -> str:
    """SHA-256 hex del JSON canónico (claves ordenadas, sin espacios) de los parámetros."""
    canonical = json.dumps(params, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
