import json
from typing import Any

import cv2
import httpx
import numpy as np
import pytest

from app.detectors.openai_vision import INSTRUCTIONS, OpenAiVisionDetector, parse_response
from app.domain.detector import DetectorError, InvalidParamsError


def png(width: int, height: int) -> bytes:
    return cv2.imencode(".png", np.zeros((height, width, 3), dtype=np.uint8))[1].tobytes()


def completed(animals: list[dict[str, float]]) -> dict[str, Any]:
    return {
        "status": "completed",
        "output": [
            {"type": "reasoning", "summary": []},
            {
                "type": "message",
                "content": [{"type": "output_text", "text": json.dumps({"animals": animals})}],
            },
        ],
    }


def detector(handler: Any, api_key: str | None = "test-key") -> OpenAiVisionDetector:
    return OpenAiVisionDetector(
        api_key,
        name="openai-vision",
        model="gpt-6-astra",
        label="IA · GPT-6 Astra (OpenAI)",
        description="",
        transport=httpx.MockTransport(handler),
    )


def test_points_come_back_in_original_pixels_without_duplicates() -> None:
    requests: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(json.loads(request.content))
        # Un animal en el centro de cada tesela y un punto dudoso que se descarta.
        return httpx.Response(
            200,
            json=completed(
                [{"x": 0.5, "y": 0.5, "confidence": 0.9}, {"x": 0, "y": 0, "confidence": 0.1}]
            ),
        )

    d = detector(handler)
    params = d.resolve_params({"tile_px": 512, "overlap": 0.1})
    output = d.detect(png(1000, 600), params)

    assert (output.width, output.height) == (1000, 600)
    assert requests[0]["model"] == "gpt-6-astra"
    assert requests[0]["text"]["format"]["strict"] is True
    assert len(output.detections) == len(requests)
    for det in output.detections:
        assert det.kind == "punto"
        assert det.score == 0.9
        assert 0 <= det.x < 1000
        assert 0 <= det.y < 600
    assert len({(round(d.x), round(d.y)) for d in output.detections}) == len(output.detections)


def test_instructions_ask_for_normalized_coordinates() -> None:
    assert "fracción del ancho" in INSTRUCTIONS
    assert "píxeles de la imagen que recibes" not in INSTRUCTIONS


def test_api_errors_and_refusals_fail_the_count() -> None:
    d = detector(lambda _r: httpx.Response(401, json={"error": {}}))
    with pytest.raises(DetectorError, match="OPENAI_API_KEY"):
        d.detect(png(300, 300), d.resolve_params(None))

    with pytest.raises(DetectorError, match="declined"):
        parse_response(
            {
                "status": "completed",
                "output": [{"type": "message", "content": [{"type": "refusal"}]}],
            }
        )
    with pytest.raises(DetectorError, match="max_output_tokens"):
        parse_response(
            {"status": "incomplete", "incomplete_details": {"reason": "max_output_tokens"}}
        )


def test_unavailable_without_key_and_rejects_unknown_params() -> None:
    d = detector(lambda _r: httpx.Response(500), api_key=None)
    assert d.available is False
    with pytest.raises(InvalidParamsError):
        d.resolve_params({"nope": 1})
