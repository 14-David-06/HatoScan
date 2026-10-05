from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from starlette.concurrency import run_in_threadpool

from app.api.images import ImageDownloadError, download_image
from app.config import Settings, get_settings
from app.contracts.count_result_schema import CountResult
from app.contracts.detect_request_schema import DetectRequest
from app.contracts.detection_schema import Detection
from app.contracts.detector_catalog_schema import DetectorCatalog, DetectorInfo
from app.contracts.image_info_schema import ImageInfo
from app.domain.detector import (
    Detector,
    DetectorError,
    DetectorOutput,
    InvalidParamsError,
    params_hash,
)

ImageFetcher = Callable[[str], Awaitable[bytes]]

router = APIRouter()


def get_registry(request: Request) -> dict[str, Detector]:
    registry: dict[str, Detector] = request.app.state.detectors
    return registry


def get_image_fetcher(settings: Annotated[Settings, Depends(get_settings)]) -> ImageFetcher:
    async def fetch(url: str) -> bytes:
        return await download_image(
            url,
            max_bytes=settings.max_image_bytes,
            timeout_s=settings.image_download_timeout_s,
        )

    return fetch


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/v1/detectors")
def list_detectors(
    registry: Annotated[dict[str, Detector], Depends(get_registry)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DetectorCatalog:
    return DetectorCatalog(
        default_detector=settings.default_detector,
        detectors=[
            DetectorInfo(
                name=d.name,
                version=d.version,
                label=d.label,
                description=d.description,
                available=d.available,
            )
            for d in registry.values()
        ],
    )


@router.post("/v1/detect", response_model_exclude_none=True)
async def detect(
    body: DetectRequest,
    registry: Annotated[dict[str, Detector], Depends(get_registry)],
    fetch_image: Annotated[ImageFetcher, Depends(get_image_fetcher)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CountResult:
    name = body.detector or settings.default_detector
    detector = registry.get(name)
    if detector is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown detector '{name}'")
    if not detector.available:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"Detector '{name}' is not available yet"
        )

    try:
        params = detector.resolve_params(body.params)
    except InvalidParamsError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc

    started = time.perf_counter()
    try:
        image = await fetch_image(str(body.image_url))
        output = await run_in_threadpool(detector.detect, image, params)
    except ImageDownloadError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    except DetectorError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc)) from exc
    elapsed_ms = int((time.perf_counter() - started) * 1000)

    detections = to_contract_detections(output)
    return CountResult(
        conteo_id=body.conteo_id,
        detector_version=f"{detector.name}@{detector.version}",
        params=params,
        params_hash=params_hash(params),
        image=ImageInfo(width=output.width, height=output.height),
        detections=detections,
        total=sum(1 for d in detections if d.estado == "activa"),
        processing_ms=elapsed_ms,
    )


def to_contract_detections(output: DetectorOutput) -> list[Detection]:
    return [
        Detection(
            id=f"m-{index}",
            x=raw.x,
            y=raw.y,
            tipo=raw.kind,
            w=raw.w,
            h=raw.h,
            score=raw.score,
            origen="modelo",
            estado="activa",
        )
        for index, raw in enumerate(output.detections, start=1)
    ]
