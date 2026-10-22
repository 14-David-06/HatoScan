from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import create_app


@pytest.fixture
def token(monkeypatch: pytest.MonkeyPatch) -> Iterator[str]:
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.setenv("DETECTOR_API_TOKEN", "t0ken-secreto")
    get_settings.cache_clear()
    yield "t0ken-secreto"
    get_settings.cache_clear()


def test_health_is_open_without_token(token: str) -> None:
    assert TestClient(create_app({})).get("/health").status_code == 200


def test_v1_requires_the_shared_token(token: str) -> None:
    client = TestClient(create_app({}))
    assert client.get("/v1/detectors").status_code == 401
    assert client.get("/v1/detectors", headers={"authorization": "Bearer otro"}).status_code == 401
    assert client.get("/v1/detectors", headers={"authorization": "Basic x"}).status_code == 401
    ok = client.get("/v1/detectors", headers={"authorization": f"Bearer {token}"})
    assert ok.status_code == 200


def test_v1_is_unavailable_when_no_token_is_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.delenv("DETECTOR_API_TOKEN", raising=False)
    get_settings.cache_clear()
    try:
        response = TestClient(create_app({})).get(
            "/v1/detectors", headers={"authorization": "Bearer lo-que-sea"}
        )
        assert response.status_code == 503
    finally:
        get_settings.cache_clear()
