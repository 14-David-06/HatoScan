from types import SimpleNamespace
from typing import Any

import cv2
import numpy as np
import pytest

from app.detectors.claude_vision import (
    AnimalPoint,
    ClaudeVisionDetector,
    TileAnimals,
    core_regions,
)
from app.detectors.yolo_sahi import tile_origins
from app.domain.detector import DetectorError, InvalidParamsError


class FakeMessages:
    """Responde a cada tesela con un animal en su centro (en píxeles de la tesela ampliada)."""

    def __init__(self, stop_reason: str = "end_turn") -> None:
        self.calls: list[dict[str, Any]] = []
        self.stop_reason = stop_reason

    def parse(self, **kwargs: Any) -> SimpleNamespace:
        self.calls.append(kwargs)
        text = kwargs["messages"][0]["content"][1]["text"]
        width, height = (int(v) for v in text.split("mide ")[1].split(" px")[0].split("x"))
        animals = TileAnimals(
            animals=[
                AnimalPoint(x=width / 2, y=height / 2, confidence=0.9),
                AnimalPoint(x=1, y=1, confidence=0.1),
            ]
        )
        return SimpleNamespace(stop_reason=self.stop_reason, parsed_output=animals)


def detector_with(messages: FakeMessages) -> ClaudeVisionDetector:
    detector = ClaudeVisionDetector("test-key")
    detector._client = SimpleNamespace(beta=SimpleNamespace(messages=messages))  # type: ignore[assignment]
    return detector


def png(width: int, height: int) -> bytes:
    return cv2.imencode(".png", np.zeros((height, width, 3), dtype=np.uint8))[1].tobytes()


def test_core_regions_partition_the_image() -> None:
    origins = tile_origins(1000, 700, tile=300, overlap=0.2)
    cores = core_regions(origins, 1000, 700, tile=300)

    owners = np.zeros((700, 1000), dtype=int)
    for left, top, right, bottom in cores:
        ys, xs = np.mgrid[0:700, 0:1000]
        owners += (xs >= left) & (xs < right) & (ys >= top) & (ys < bottom)
    assert (owners == 1).all()


def test_points_come_back_in_original_pixels_without_duplicates() -> None:
    messages = FakeMessages()
    detector = detector_with(messages)
    params = detector.resolve_params({"tile_px": 400, "upscale": 2.0, "overlap": 0.0})

    output = detector.detect(png(800, 400), params)

    assert (output.width, output.height) == (800, 400)
    assert sorted((d.x, d.y) for d in output.detections) == [(200.0, 200.0), (600.0, 200.0)]
    assert all(d.kind == "punto" and d.score == 0.9 for d in output.detections)
    assert len(messages.calls) == 2
    assert messages.calls[0]["model"] == "claude-opus-5-5"


def test_refusal_fails_loudly() -> None:
    detector = detector_with(FakeMessages(stop_reason="refusal"))
    with pytest.raises(DetectorError, match="declined"):
        detector.detect(png(300, 300), detector.resolve_params(None))


def test_unavailable_without_api_key() -> None:
    assert ClaudeVisionDetector(None).available is False
    assert ClaudeVisionDetector("").available is False


def test_tiles_too_large_for_claude_are_rejected() -> None:
    detector = detector_with(FakeMessages())
    params = detector.resolve_params({"tile_px": 2000, "upscale": 2.0})
    with pytest.raises(InvalidParamsError):
        detector.detect(png(300, 300), params)
