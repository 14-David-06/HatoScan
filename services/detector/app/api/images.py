from __future__ import annotations

import httpx

from app.domain.detector import DetectorError


class ImageDownloadError(DetectorError):
    """No se pudo obtener la imagen original desde su URL firmada."""


async def download_image(url: str, *, max_bytes: int, timeout_s: float) -> bytes:
    """Descarga la imagen completa (sin reescalar) con límite de tamaño."""
    try:
        async with (
            httpx.AsyncClient(timeout=timeout_s, follow_redirects=True) as client,
            client.stream("GET", url) as response,
        ):
            response.raise_for_status()
            chunks: list[bytes] = []
            size = 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > max_bytes:
                    raise ImageDownloadError(f"Image exceeds {max_bytes} bytes")
                chunks.append(chunk)
            return b"".join(chunks)
    except httpx.HTTPError as exc:
        raise ImageDownloadError(f"Could not download image: {exc}") from exc
