"""Detectores de visión clásica: contraste local + componentes conexas.

Dos variantes que comparten el mismo pipeline y solo cambian la señal de contraste:

- ``classic-cv``: el animal es menos saturado que el pasto que lo rodea. Sirve para animales
  negros, grises o blancos (búfalas, cebú) sobre pasto verde.
- ``classic-cv-dark``: el animal es más oscuro que su entorno (black-hat sobre la luminancia).
  Alternativa cuando el pasto está seco y pierde saturación.

Parámetros por defecto ajustados de forma provisional sobre la foto de referencia de 120 búfalas
(versión anotada, con los círculos borrados). Falta calibrarlos con la foto original sin anotar.
"""

from __future__ import annotations

from typing import Any, ClassVar

import cv2
import numpy as np
from cv2.typing import MatLike
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.domain.detector import DetectorError, DetectorOutput, InvalidParamsError, RawDetection

Image = MatLike


class BlobParams(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    # Debe ser mayor que un animal (10-20 px) para que el fondo local no lo incluya.
    background_kernel_px: int = Field(31, ge=9, le=201)
    # Diferencia mínima (0-255) entre el fondo local y el animal.
    contrast_threshold: int = Field(60, ge=1, le=255)
    # Los animales son grises: se descartan blobs con saturación media (0-255) mayor que esto.
    max_blob_saturation: int = Field(60, ge=0, le=255)
    min_area_px: int = Field(25, ge=1)
    # Divide blobs de animales pegados según el área típica de un animal en la imagen.
    split_merged: bool = True
    max_animals_per_blob: int = Field(12, ge=1, le=50)


class _BlobDetector:
    """Pipeline común. Las subclases definen la señal de contraste y sus valores por defecto."""

    name: ClassVar[str]
    version: ClassVar[str]
    label: ClassVar[str]
    description: ClassVar[str]
    available: ClassVar[bool] = True
    defaults: ClassVar[dict[str, Any]] = {}

    def resolve_params(self, params: dict[str, Any] | None) -> dict[str, Any]:
        try:
            return BlobParams.model_validate({**self.defaults, **(params or {})}).model_dump()
        except ValidationError as exc:
            raise InvalidParamsError(str(exc)) from exc

    def detect(self, image: bytes, params: dict[str, Any]) -> DetectorOutput:
        p = BlobParams.model_validate(params)
        bgr = decode(image)
        saturation = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[..., 1]
        contrast = self.contrast(bgr, saturation, p.background_kernel_px)

        binary = (cv2.GaussianBlur(contrast, (3, 3), 0) > p.contrast_threshold).astype(np.uint8)
        opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        mask = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, ellipse(5))

        height, width = bgr.shape[:2]
        points = blobs_to_points(mask, saturation, p)
        return DetectorOutput(
            width=width,
            height=height,
            detections=[RawDetection(x=x, y=y, kind="punto") for x, y in points],
        )

    def contrast(self, bgr: Image, saturation: Image, kernel_px: int) -> Image:
        raise NotImplementedError


class ClassicCvDetector(_BlobDetector):
    name = "classic-cv"
    version = "0.2.0"
    label = "Visión clásica · baja saturación"
    description = (
        "Busca manchas grises (poco saturadas) sobre el pasto. Sirve para búfalas y ganado "
        "negro, gris o blanco sobre pasto verde. Recomendado."
    )

    def contrast(self, bgr: Image, saturation: Image, kernel_px: int) -> Image:
        # Cierre morfológico: saturación del pasto alrededor, sin los huecos de los animales.
        background = cv2.morphologyEx(saturation, cv2.MORPH_CLOSE, ellipse(kernel_px))
        return cv2.subtract(background, saturation)


class ClassicCvDarkDetector(_BlobDetector):
    name = "classic-cv-dark"
    version = "0.1.0"
    label = "Visión clásica · contraste oscuro"
    description = (
        "Busca manchas más oscuras que su entorno. Alternativa para pasto seco o poco verde; "
        "en pasto verde da más falsos positivos que el método de baja saturación."
    )
    defaults: ClassVar[dict[str, Any]] = {
        "background_kernel_px": 25,
        "contrast_threshold": 45,
        "max_blob_saturation": 80,
    }

    def contrast(self, bgr: Image, saturation: Image, kernel_px: int) -> Image:
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        return cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, ellipse(kernel_px))


def decode(image: bytes) -> Image:
    """Decodifica a resolución completa. IMREAD_COLOR aplica la orientación EXIF, igual que el
    navegador, para que las coordenadas coincidan con la imagen que ve el revisor."""
    decoded = cv2.imdecode(np.frombuffer(image, dtype=np.uint8), cv2.IMREAD_COLOR)
    if decoded is None:
        raise DetectorError("Could not decode image (expected JPEG, PNG or TIFF)")
    return decoded


def ellipse(size: int) -> Image:
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))


def blobs_to_points(mask: Image, saturation: Image, p: BlobParams) -> list[tuple[float, float]]:
    """Filtra componentes y devuelve un punto por animal, en píxeles de la imagen original."""
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)

    kept: list[tuple[int, int]] = []
    for i in range(1, count):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < p.min_area_px:
            continue
        x, y, w, h = (int(v) for v in stats[i, :4])
        inside = labels[y : y + h, x : x + w] == i
        if float(saturation[y : y + h, x : x + w][inside].mean()) > p.max_blob_saturation:
            continue
        kept.append((i, area))
    if not kept:
        return []

    typical_area = float(np.median([area for _, area in kept]))
    points: list[tuple[float, float]] = []
    for i, area in kept:
        animals = max(1, round(area / typical_area)) if p.split_merged else 1
        if animals > p.max_animals_per_blob:
            # Demasiado grande para ser un grupo de animales: suelo, sombra o vegetación.
            continue
        if animals == 1:
            points.append((float(centroids[i][0]), float(centroids[i][1])))
            continue
        x, y, w, h = (int(v) for v in stats[i, :4])
        ys, xs = np.nonzero(labels[y : y + h, x : x + w] == i)
        samples = np.column_stack((xs + x, ys + y)).astype(np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5)
        # Semilla fija: mismo resultado para la misma imagen y parámetros (trazabilidad).
        cv2.setRNGSeed(0)
        labels_out = np.zeros((len(samples), 1), dtype=np.int32)
        _, _, centers = cv2.kmeans(samples, animals, labels_out, criteria, 3, cv2.KMEANS_PP_CENTERS)
        points.extend((float(cx), float(cy)) for cx, cy in centers)
    return points
