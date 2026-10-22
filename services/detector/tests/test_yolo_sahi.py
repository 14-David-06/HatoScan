from pathlib import Path

import cv2
import numpy as np
import pytest

from app.detectors.yolo_sahi import YoloSahiDetector, YoloSahiParams, decode_yolox, tile_origins
from app.domain.detector import DetectorError, InvalidParamsError

MODEL = Path(__file__).resolve().parents[1] / "models" / "yolox_s.onnx"


def test_tiles_cover_the_whole_image_with_overlap() -> None:
    origins = tile_origins(1000, 700, tile=320, overlap=0.25)

    covered = np.zeros((700, 1000), dtype=bool)
    for x, y in origins:
        covered[y : y + 320, x : x + 320] = True
    assert covered.all()
    assert max(x for x, _ in origins) == 1000 - 320
    assert max(y for _, y in origins) == 700 - 320


def test_small_image_is_a_single_tile() -> None:
    assert tile_origins(200, 150, tile=320, overlap=0.25) == [(0, 0)]


def test_decode_keeps_only_requested_classes_above_threshold() -> None:
    raw = np.zeros((8400, 85), dtype=np.float32)
    raw[0, :5] = [0.5, 0.5, np.log(2.0), np.log(3.0), 0.9]  # celda (0, 0), paso 8
    raw[0, 5 + 19] = 0.8  # vaca
    raw[1, 4] = 0.9
    raw[1, 5 + 0] = 0.99  # persona: no es un animal de pastoreo

    boxes, scores = decode_yolox(raw, 640, YoloSahiParams())

    assert scores.tolist() == pytest.approx([0.72])
    assert boxes.tolist()[0] == pytest.approx([4 - 8, 4 - 12, 16, 24])


def test_missing_weights_fail_loudly(tmp_path: Path) -> None:
    detector = YoloSahiDetector(tmp_path / "missing.onnx")
    assert detector.available is False
    with pytest.raises(DetectorError):
        detector.resolve_params(None)


def test_invalid_params_are_rejected(tmp_path: Path) -> None:
    with pytest.raises(InvalidParamsError):
        YoloSahiDetector(tmp_path / "m.onnx").resolve_params({"tile_px": 10})


@pytest.mark.skipif(not MODEL.is_file(), reason="sin pesos: sh scripts/download_model.sh")
def test_params_identify_the_model_weights() -> None:
    params = YoloSahiDetector(MODEL).resolve_params(None)
    assert params["model"] == "yolox_s.onnx"
    assert len(params["model_sha256"]) == 64


@pytest.mark.skipif(not MODEL.is_file(), reason="sin pesos: sh scripts/download_model.sh")
def test_boxes_are_in_original_image_pixels() -> None:
    blank = cv2.imencode(".png", np.full((700, 1000, 3), (60, 140, 80), dtype=np.uint8))[1]
    detector = YoloSahiDetector(MODEL)

    output = detector.detect(blank.tobytes(), detector.resolve_params(None))

    assert (output.width, output.height) == (1000, 700)
    for d in output.detections:
        assert d.kind == "caja"
        assert d.w is not None
        assert d.h is not None
        assert 0 <= d.x <= d.x + d.w <= 1000
        assert 0 <= d.y <= d.y + d.h <= 700
