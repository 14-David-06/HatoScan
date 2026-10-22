"""Detector con modelos de visión de OpenAI (Responses API) sobre teselas de la foto.

OpenAI puede reescalar internamente la imagen que recibe, así que no se le piden píxeles sino
coordenadas normalizadas (0-1) dentro de la tesela: sobreviven a cualquier reescalado. Se llama a
la API con httpx (ya es dependencia del servicio) en lugar de sumar el SDK de OpenAI.
"""

from __future__ import annotations

import base64
import json
from typing import Any, Literal

import cv2
import httpx
from cv2.typing import MatLike
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.detectors.claude_vision import SYSTEM_PROMPT
from app.detectors.tiling import TilePoint, detect_in_tiles
from app.domain.detector import DetectorError, DetectorOutput, InvalidParamsError

RESPONSES_URL = "https://api.openai.com/v1/responses"

INSTRUCTIONS = SYSTEM_PROMPT.replace(
    "en píxeles de la imagen que recibes (origen arriba a la izquierda)",
    "como fracción del ancho y del alto de la imagen (0 a 1, origen arriba a la izquierda)",
)

TILE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["animals"],
    "properties": {
        "animals": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["x", "y", "confidence"],
                "properties": {
                    "x": {"type": "number", "description": "Centro, fracción del ancho (0-1)"},
                    "y": {"type": "number", "description": "Centro, fracción del alto (0-1)"},
                    "confidence": {"type": "number", "description": "0 a 1"},
                },
            },
        }
    },
}


class NormalizedPoint(BaseModel):
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)


class NormalizedAnimals(BaseModel):
    animals: list[NormalizedPoint]


class OpenAiVisionParams(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    model: str = "gpt-6-astra"
    # "low": mismo conteo, varias veces más rápido que "high" (medido con GPT-6.1 Sol).
    effort: Literal["low", "medium", "high", "xhigh", "max"] = "low"
    # 512 px ampliados 1.5 veces = 768 px: el tamaño que OpenAI analiza sin reducir.
    tile_px: int = Field(512, ge=128, le=1024)
    upscale: float = Field(1.5, ge=1.0, le=4.0)
    overlap: float = Field(0.1, ge=0.0, le=0.5)
    min_confidence: float = Field(0.3, ge=0.0, le=1.0)
    max_parallel_requests: int = Field(16, ge=1, le=32)
    timeout_s: float = Field(300.0, gt=0)


class OpenAiVisionDetector:
    """Un método por modelo de OpenAI: mismo código, distinto nombre y modelo."""

    version = "0.1.0"

    def __init__(
        self,
        api_key: str | None,
        *,
        name: str,
        model: str,
        label: str,
        description: str,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.name = name
        self.label = label
        self.description = description
        self._model = model
        self._api_key = api_key
        self._transport = transport

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    def resolve_params(self, params: dict[str, Any] | None) -> dict[str, Any]:
        try:
            merged = {"model": self._model, **(params or {})}
            return OpenAiVisionParams.model_validate(merged).model_dump()
        except ValidationError as exc:
            raise InvalidParamsError(str(exc)) from exc

    def detect(self, image: bytes, params: dict[str, Any]) -> DetectorOutput:
        p = OpenAiVisionParams.model_validate(params)
        if not self._api_key:
            raise DetectorError("OPENAI_API_KEY is not configured")
        with httpx.Client(
            transport=self._transport,
            timeout=p.timeout_s,
            headers={"authorization": f"Bearer {self._api_key}"},
        ) as client:

            def ask(tile: MatLike) -> list[TilePoint]:
                tile_h, tile_w = tile.shape[:2]
                return [
                    TilePoint(x=a.x * tile_w, y=a.y * tile_h, confidence=a.confidence)
                    for a in self._ask(client, tile, p)
                ]

            return detect_in_tiles(
                image,
                tile_px=p.tile_px,
                overlap=p.overlap,
                min_confidence=p.min_confidence,
                max_parallel_requests=p.max_parallel_requests,
                ask=ask,
            )

    def _ask(
        self, client: httpx.Client, tile: MatLike, p: OpenAiVisionParams
    ) -> list[NormalizedPoint]:
        tile_h, tile_w = tile.shape[:2]
        sent = cv2.resize(
            tile,
            (round(tile_w * p.upscale), round(tile_h * p.upscale)),
            interpolation=cv2.INTER_CUBIC,
        )
        ok, png = cv2.imencode(".png", sent)
        if not ok:
            raise DetectorError("Could not encode tile for OpenAI")
        data = base64.standard_b64encode(png.tobytes()).decode("ascii")
        body = {
            "model": p.model,
            "instructions": INSTRUCTIONS,
            "reasoning": {"effort": p.effort},
            "input": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_image",
                            "image_url": f"data:image/png;base64,{data}",
                            "detail": "high",
                        },
                        {"type": "input_text", "text": "Marca cada animal."},
                    ],
                }
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "tile_animals",
                    "strict": True,
                    "schema": TILE_SCHEMA,
                }
            },
        }
        try:
            response = client.post(RESPONSES_URL, json=body)
        except httpx.HTTPError as exc:
            raise DetectorError(f"Could not reach the OpenAI API: {exc}") from exc
        if response.status_code == 401:
            raise DetectorError("OpenAI rejected the API key (OPENAI_API_KEY)")
        if response.status_code == 429:
            raise DetectorError(f"OpenAI rate limit reached: {response.text[:300]}")
        if response.status_code >= 400:
            raise DetectorError(f"OpenAI API error {response.status_code}: {response.text[:300]}")
        return parse_response(response.json())


def parse_response(payload: dict[str, Any]) -> list[NormalizedPoint]:
    """Extrae los puntos del JSON de la respuesta; rechaza respuestas incompletas o negadas."""
    if payload.get("status") != "completed":
        reason = (payload.get("incomplete_details") or {}).get("reason") or payload.get("status")
        raise DetectorError(f"OpenAI returned no usable answer ({reason})")
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for part in item.get("content", []):
            if part.get("type") == "refusal":
                raise DetectorError("OpenAI declined to analyse the image")
            if part.get("type") == "output_text":
                try:
                    return NormalizedAnimals.model_validate(json.loads(part["text"])).animals
                except (json.JSONDecodeError, ValidationError) as exc:
                    raise DetectorError(f"OpenAI returned invalid JSON: {exc}") from exc
    raise DetectorError("OpenAI returned no text output")
