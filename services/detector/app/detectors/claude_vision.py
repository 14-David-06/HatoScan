"""Detector con Claude (visión): un modelo multimodal marca cada animal en teselas de la foto.

Claude acepta imágenes de hasta 2576 px de lado y devuelve coordenadas 1:1 con los píxeles de la
imagen que recibe. Cada tesela (ver `tiling`) se amplía para que el animal sea visible y se envía
por separado; los puntos vuelven a píxeles de la imagen original.
"""

from __future__ import annotations

import base64
import threading
from typing import Any, Literal

import anthropic
import cv2
from cv2.typing import MatLike
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.detectors.tiling import TilePoint, core_regions, detect_in_tiles
from app.domain.detector import DetectorError, DetectorOutput, InvalidParamsError

__all__ = ["AnimalPoint", "ClaudeVisionDetector", "TileAnimals", "core_regions"]

MAX_IMAGE_SIDE_PX = 2576

SYSTEM_PROMPT = """\
Eres un contador de ganado para inventarios en fincas de los Llanos colombianos. Recibes un \
recorte de una foto aérea cenital tomada con dron sobre un potrero: pasto, caminos, charcos, \
árboles, palmas y, a veces, animales (búfalas o bovinos) vistos desde arriba, que se ven como \
formas ovaladas oscuras, grises o claras, a menudo con su sombra al lado.

Marca cada animal con un punto en el centro de su cuerpo, en píxeles de la imagen que recibes \
(origen arriba a la izquierda). Incluye animales parcialmente cortados por el borde, echados o \
pegados a otros (un punto por animal). No marques sombras, troncos, arbustos, piedras, charcos, \
hormigueros ni parches de suelo. Si no hay animales, devuelve una lista vacía. El conteo lo \
confirma después una persona: es mejor un punto dudoso con confianza baja que omitir un animal."""


class AnimalPoint(BaseModel):
    x: float = Field(description="Centro del animal, píxeles horizontales de esta imagen")
    y: float = Field(description="Centro del animal, píxeles verticales de esta imagen")
    confidence: float = Field(description="0 a 1: qué tan seguro estás de que es un animal")


class TileAnimals(BaseModel):
    animals: list[AnimalPoint]


class ClaudeVisionParams(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    model: str = "claude-opus-5-5"
    # Marcar animales es percepción, no razonamiento largo: "low" da el mismo conteo en segundos
    # (medido: Opus 18 s frente a varios minutos con "high" sobre la misma tesela).
    effort: Literal["low", "medium", "high", "xhigh", "max"] = "low"
    # Lado de la tesela en píxeles de la imagen original y cuánto se amplía antes de enviarla.
    # 1024 x 2 = 2048 px: pocas teselas por foto y el animal de 10-20 px queda en 20-40 px.
    tile_px: int = Field(1024, ge=128, le=MAX_IMAGE_SIDE_PX)
    upscale: float = Field(2.0, ge=1.0, le=4.0)
    overlap: float = Field(0.1, ge=0.0, le=0.5)
    min_confidence: float = Field(0.3, ge=0.0, le=1.0)
    max_parallel_requests: int = Field(16, ge=1, le=32)


class ClaudeVisionDetector:
    """Un método por modelo de Anthropic (Opus, Sonnet): mismo código, distinto nombre y modelo."""

    version = "0.2.0"

    def __init__(
        self,
        api_key: str | None,
        *,
        name: str = "claude-vision",
        model: str = "claude-opus-5-5",
        label: str = "IA · Claude Opus 5.5 (Anthropic)",
        description: str = (
            "El modelo de visión más capaz de Anthropic revisa la foto por partes y marca cada "
            "animal. No necesita entrenamiento; cuesta por foto y tarda unos minutos."
        ),
    ) -> None:
        self.name = name
        self.label = label
        self.description = description
        self._model = model
        self._api_key = api_key
        self._client: anthropic.Anthropic | None = None
        self._lock = threading.Lock()

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    def resolve_params(self, params: dict[str, Any] | None) -> dict[str, Any]:
        try:
            merged = {"model": self._model, **(params or {})}
            return ClaudeVisionParams.model_validate(merged).model_dump()
        except ValidationError as exc:
            raise InvalidParamsError(str(exc)) from exc

    def detect(self, image: bytes, params: dict[str, Any]) -> DetectorOutput:
        p = ClaudeVisionParams.model_validate(params)
        if p.tile_px * p.upscale > MAX_IMAGE_SIDE_PX:
            raise InvalidParamsError(f"tile_px * upscale must be <= {MAX_IMAGE_SIDE_PX}")

        def ask(tile: MatLike) -> list[TilePoint]:
            # Píxeles de la tesela ampliada → píxeles de la tesela recortada.
            return [
                TilePoint(x=a.x / p.upscale, y=a.y / p.upscale, confidence=a.confidence)
                for a in self._ask(tile, p)
            ]

        return detect_in_tiles(
            image,
            tile_px=p.tile_px,
            overlap=p.overlap,
            min_confidence=p.min_confidence,
            max_parallel_requests=p.max_parallel_requests,
            ask=ask,
        )

    def _ask(self, tile: MatLike, p: ClaudeVisionParams) -> list[AnimalPoint]:
        tile_h, tile_w = tile.shape[:2]
        sent = cv2.resize(
            tile,
            (round(tile_w * p.upscale), round(tile_h * p.upscale)),
            interpolation=cv2.INTER_CUBIC,
        )
        ok, png = cv2.imencode(".png", sent)
        if not ok:
            raise DetectorError("Could not encode tile for Claude")
        data = base64.standard_b64encode(png.tobytes()).decode("ascii")
        try:
            response = self._get_client().beta.messages.parse(
                model=p.model,
                max_tokens=16000,
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                thinking={"type": "adaptive"},
                output_config={"effort": p.effort},
                system=SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": data,
                                },
                            },
                            {
                                "type": "text",
                                "text": (
                                    f"La imagen mide {sent.shape[1]}x{sent.shape[0]} px. "
                                    "Marca cada animal."
                                ),
                            },
                        ],
                    }
                ],
                output_format=TileAnimals,
            )
        except anthropic.AuthenticationError as exc:
            raise DetectorError("Claude rejected the API key (ANTHROPIC_API_KEY)") from exc
        except anthropic.RateLimitError as exc:
            raise DetectorError(f"Claude rate limit reached: {exc}") from exc
        except anthropic.APIStatusError as exc:
            raise DetectorError(f"Claude API error {exc.status_code}: {exc.message}") from exc
        except anthropic.APIConnectionError as exc:
            raise DetectorError(f"Could not reach the Claude API: {exc}") from exc

        if response.stop_reason == "refusal":
            raise DetectorError("Claude declined to analyse the image")
        if response.stop_reason == "max_tokens" or response.parsed_output is None:
            raise DetectorError(f"Claude returned no usable answer ({response.stop_reason})")
        return list(response.parsed_output.animals)

    def _get_client(self) -> anthropic.Anthropic:
        with self._lock:
            if self._client is None:
                if not self._api_key:
                    raise DetectorError("ANTHROPIC_API_KEY is not configured")
                self._client = anthropic.Anthropic(api_key=self._api_key)
            return self._client
