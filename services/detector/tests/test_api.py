from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api.auth import require_api_token
from app.api.images import ImageDownloadError
from app.api.routes import get_image_fetcher
from app.contracts.count_result_schema import CountResult
from app.contracts.detector_catalog_schema import DetectorCatalog
from app.detectors import build_registry
from app.detectors.classic_cv import ClassicCvDetector
from app.detectors.yolo_sahi import YoloSahiDetector
from app.domain.detector import (
    Detector,
    DetectorError,
    DetectorOutput,
    RawDetection,
    params_hash,
)
from app.main import create_app


class FakeDetector:
    name = "fake"
    version = "1.2.3"
    label = "Falso"
    description = "Detector de prueba."
    available = True

    def __init__(self) -> None:
        self.received: bytes | None = None

    def resolve_params(self, params: dict[str, Any] | None) -> dict[str, Any]:
        return {"threshold": 0.5, **(params or {})}

    def detect(self, image: bytes, params: dict[str, Any]) -> DetectorOutput:
        self.received = image
        return DetectorOutput(
            width=5472,
            height=3648,
            detections=[
                RawDetection(x=10, y=20, kind="caja", w=15, h=12, score=0.9),
                RawDetection(x=100, y=200, kind="punto"),
            ],
        )


IMAGE = b"\xff\xd8 full resolution bytes"
REQUEST = {"conteo_id": "SIRIUS-CONTEO-0001", "image_url": "https://storage.test/a.jpg"}


def make_client(detectors: dict[str, Detector], fetch_error: Exception | None = None) -> TestClient:
    app = create_app(detectors)

    async def fetch(_url: str) -> bytes:
        if fetch_error:
            raise fetch_error
        return IMAGE

    app.dependency_overrides[get_image_fetcher] = lambda: fetch
    # La autenticación se prueba aparte (test_auth.py); aquí se desactiva.
    app.dependency_overrides[require_api_token] = lambda: None
    return TestClient(app)


def test_health() -> None:
    assert make_client({}).get("/health").json() == {"status": "ok"}


def test_detect_returns_a_valid_count_result() -> None:
    fake = FakeDetector()
    response = make_client({"fake": fake}).post("/v1/detect", json={**REQUEST, "detector": "fake"})

    assert response.status_code == 200
    result = CountResult.model_validate(response.json())
    assert result.detector_version == "fake@1.2.3"
    assert result.params == {"threshold": 0.5}
    assert result.params_hash == params_hash({"threshold": 0.5})
    assert result.total == 2
    assert all(d.origen == "modelo" and d.estado == "activa" for d in result.detections)
    assert "w" not in response.json()["detections"][1]
    assert fake.received == IMAGE


def test_unknown_detector_is_rejected() -> None:
    response = make_client({}).post("/v1/detect", json={**REQUEST, "detector": "nope"})
    assert response.status_code == 422


def test_invalid_request_is_rejected() -> None:
    response = make_client({}).post("/v1/detect", json={**REQUEST, "conteo_id": "X-1"})
    assert response.status_code == 422


def test_invalid_params_are_rejected() -> None:
    client = make_client({"classic-cv": ClassicCvDetector()})
    response = client.post("/v1/detect", json={**REQUEST, "params": {"min_area_px": -3}})
    assert response.status_code == 422


def test_download_failure_is_a_bad_gateway() -> None:
    client = make_client({"fake": FakeDetector()}, fetch_error=ImageDownloadError("403"))
    response = client.post("/v1/detect", json={**REQUEST, "detector": "fake"})
    assert response.status_code == 502


class FailingDetector(FakeDetector):
    def detect(self, image: bytes, params: dict[str, Any]) -> DetectorOutput:
        raise DetectorError("Could not decode image")


def test_detector_failure_is_reported_not_hidden() -> None:
    client = make_client({"fake": FailingDetector()})
    response = client.post("/v1/detect", json={**REQUEST, "detector": "fake"})
    assert response.status_code == 500
    assert "Could not decode image" in response.json()["detail"]


def test_catalog_lists_every_method_and_the_default() -> None:
    response = make_client(build_registry()).get("/v1/detectors")

    assert response.status_code == 200
    catalog = DetectorCatalog.model_validate(response.json())
    assert catalog.default_detector == "classic-cv"
    assert [d.name for d in catalog.detectors] == ["classic-cv", "classic-cv-dark", "yolo-sahi"]
    assert [d.available for d in catalog.detectors] == [True, True, False]


def test_unavailable_detector_is_rejected_before_downloading() -> None:
    client = make_client({"yolo-sahi": YoloSahiDetector()}, fetch_error=AssertionError("no"))
    response = client.post("/v1/detect", json={**REQUEST, "detector": "yolo-sahi"})
    assert response.status_code == 422
    assert "not available" in response.json()["detail"]


@pytest.mark.parametrize(
    ("a", "b"),
    [({"x": 1, "y": 2}, {"y": 2, "x": 1}), ({"n": {"b": 1, "a": 2}}, {"n": {"a": 2, "b": 1}})],
)
def test_params_hash_is_order_independent(a: dict[str, Any], b: dict[str, Any]) -> None:
    assert params_hash(a) == params_hash(b)
    assert len(params_hash(a)) == 64
