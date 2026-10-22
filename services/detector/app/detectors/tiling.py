"""Teselado para detectores con modelos multimodales (Claude, OpenAI).

Una foto de dron es más grande de lo que un modelo de visión acepta y los animales miden 10-20 px,
así que no se reduce: se recorta en teselas a resolución completa y cada una se consulta por
separado. Cada tesela es dueña de su "núcleo" (la tesela menos la mitad del solape con sus
vecinas): un punto solo se conserva en la tesela cuyo núcleo lo contiene, así el solape no duplica
animales.
"""

from __future__ import annotations

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from cv2.typing import MatLike

from app.detectors.classic_cv import decode
from app.detectors.yolo_sahi import tile_origins
from app.domain.detector import DetectorOutput, RawDetection


@dataclass(frozen=True, slots=True)
class TilePoint:
    """Animal en píxeles de la tesela recortada (antes de cualquier ampliación)."""

    x: float
    y: float
    confidence: float


def detect_in_tiles(
    image: bytes,
    *,
    tile_px: int,
    overlap: float,
    min_confidence: float,
    max_parallel_requests: int,
    ask: Callable[[MatLike], list[TilePoint]],
) -> DetectorOutput:
    """Consulta `ask` por cada tesela y devuelve los puntos en píxeles de la imagen original."""
    bgr = decode(image)
    height, width = bgr.shape[:2]
    origins = tile_origins(width, height, tile_px, overlap)
    cores = core_regions(origins, width, height, tile_px)

    def run(index: int) -> list[RawDetection]:
        x0, y0 = origins[index]
        tile = bgr[y0 : y0 + tile_px, x0 : x0 + tile_px]
        left, top, right, bottom = cores[index]
        kept: list[RawDetection] = []
        for point in ask(tile):
            if point.confidence < min_confidence:
                continue
            x = x0 + point.x
            y = y0 + point.y
            if left <= x < right and top <= y < bottom:
                kept.append(RawDetection(x=x, y=y, kind="punto", score=point.confidence))
        return kept

    with ThreadPoolExecutor(max_workers=max_parallel_requests) as pool:
        results = list(pool.map(run, range(len(origins))))
    detections = [d for tile_detections in results for d in tile_detections]
    return DetectorOutput(width=width, height=height, detections=detections)


def core_regions(
    origins: list[tuple[int, int]], width: int, height: int, tile: int
) -> list[tuple[float, float, float, float]]:
    """Núcleo de cada tesela: se parte el solape con cada vecina por la mitad.

    Los núcleos no se solapan y cubren toda la imagen, así cada punto pertenece a una tesela.
    """
    xs = sorted({x for x, _ in origins})
    ys = sorted({y for _, y in origins})

    def bounds(starts: list[int], length: int) -> dict[int, tuple[float, float]]:
        result: dict[int, tuple[float, float]] = {}
        for i, start in enumerate(starts):
            low = 0.0 if i == 0 else (start + starts[i - 1] + tile) / 2
            high = float(length) if i == len(starts) - 1 else (starts[i + 1] + start + tile) / 2
            result[start] = (low, high)
        return result

    bx = bounds(xs, width)
    by = bounds(ys, height)
    return [(bx[x][0], by[y][0], bx[x][1], by[y][1]) for x, y in origins]
