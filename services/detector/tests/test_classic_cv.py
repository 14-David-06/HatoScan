import os
from pathlib import Path

import cv2
import numpy as np
import pytest

from app.detectors.classic_cv import ClassicCvDarkDetector, ClassicCvDetector
from app.domain.detector import DetectorError, InvalidParamsError

# (x, y) de cada animal; los dos últimos pares están pegados entre sí.
ANIMALS = [
    (60, 60),
    (200, 80),
    (340, 50),
    (90, 220),
    (250, 240),
    (420, 200),
    (150, 330),
    (470, 330),
    (300, 360),
    (316, 360),
    (380, 120),
    (380, 136),
]


def synthetic_pasture(width: int = 520, height: int = 400) -> bytes:
    """Pasto verde saturado con ruido y animales gris oscuro de ~16x10 px."""
    rng = np.random.default_rng(7)
    hsv = np.empty((height, width, 3), dtype=np.uint8)
    hsv[..., 0] = 40 + rng.integers(-4, 5, (height, width))
    hsv[..., 1] = 150 + rng.integers(-25, 26, (height, width))
    hsv[..., 2] = 150 + rng.integers(-25, 26, (height, width))
    image = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    for x, y in ANIMALS:
        cv2.ellipse(image, (x, y), (8, 5), 30, 0, 360, (60, 62, 64), -1)
    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return encoded.tobytes()


def nearest_distances(points: list[tuple[float, float]]) -> list[float]:
    return [min(np.hypot(px - x, py - y) for px, py in points) for x, y in ANIMALS]


def test_low_saturation_detector_finds_every_animal_in_original_pixels() -> None:
    detector = ClassicCvDetector()
    output = detector.detect(synthetic_pasture(), detector.resolve_params(None))

    assert (output.width, output.height) == (520, 400)
    assert len(output.detections) == len(ANIMALS)
    points = [(d.x, d.y) for d in output.detections]
    assert max(nearest_distances(points)) < 6
    assert all(d.kind == "punto" for d in output.detections)


def test_dark_contrast_detector_finds_dark_animals() -> None:
    detector = ClassicCvDarkDetector()
    output = detector.detect(synthetic_pasture(), detector.resolve_params(None))
    assert len(output.detections) == len(ANIMALS)


def test_detection_is_deterministic() -> None:
    detector = ClassicCvDetector()
    params = detector.resolve_params(None)
    image = synthetic_pasture()
    assert detector.detect(image, params) == detector.detect(image, params)


def test_empty_pasture_has_no_detections() -> None:
    blank = cv2.imencode(".png", np.full((200, 200, 3), (40, 160, 90), dtype=np.uint8))[1]
    detector = ClassicCvDetector()
    assert detector.detect(blank.tobytes(), detector.resolve_params(None)).detections == []


def test_undecodable_image_is_an_error() -> None:
    detector = ClassicCvDetector()
    with pytest.raises(DetectorError, match="decode"):
        detector.detect(b"not an image", detector.resolve_params(None))


def test_params_are_completed_and_validated() -> None:
    dark = ClassicCvDarkDetector().resolve_params({"min_area_px": 30})
    assert dark["min_area_px"] == 30
    assert dark["background_kernel_px"] == 25
    with pytest.raises(InvalidParamsError):
        ClassicCvDetector().resolve_params({"contrast_threshold": 0})
    with pytest.raises(InvalidParamsError):
        ClassicCvDetector().resolve_params({"unknown": 1})


REFERENCE = os.environ.get("HATOSCAN_REFERENCE_IMAGE")


@pytest.mark.skipif(not REFERENCE, reason="HATOSCAN_REFERENCE_IMAGE no definido")
def test_reference_photo_120_buffaloes() -> None:
    """Foto de referencia original (sin anotar): 120 búfalas. Tolerancia: ±10 %."""
    assert REFERENCE
    detector = ClassicCvDetector()
    output = detector.detect(Path(REFERENCE).read_bytes(), detector.resolve_params(None))
    assert abs(len(output.detections) - 120) <= 12
