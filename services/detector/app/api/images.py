from __future__ import annotations

from collections.abc import Iterable
from urllib.parse import urlsplit

import httpx

from app.domain.detector import DetectorError


class ImageDownloadError(DetectorError):
    """No se pudo obtener la imagen original desde su URL firmada."""


class ImageHostNotAllowedError(ImageDownloadError):
    """La URL apunta a un host que no está en ``DETECTOR_ALLOWED_IMAGE_HOSTS``."""


def check_image_url(url: str, allowed_hosts: Iterable[str]) -> None:
    """Solo http(s) hacia un host de la lista. Evita que el servicio descargue de direcciones
    internas o arbitrarias (SSRF) usando las llaves de IA a costa de quien lo despliega."""
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    allowed = {h.strip().lower() for h in allowed_hosts if h.strip()}
    if parts.scheme not in {"http", "https"} or not host or host not in allowed:
        raise ImageHostNotAllowedError(
            f"Image host '{host or url}' is not allowed (DETECTOR_ALLOWED_IMAGE_HOSTS)"
        )


async def download_image(
    url: str,
    *,
    allowed_hosts: Iterable[str],
    max_bytes: int,
    timeout_s: float,
    transport: httpx.AsyncBaseTransport | None = None,
) -> bytes:
    """Descarga la imagen completa (sin reescalar) con límite de tamaño. No sigue redirecciones:
    la URL firmada de la app apunta directo al archivo, y una redirección podría salir de la lista
    de hosts permitidos."""
    check_image_url(url, allowed_hosts)
    try:
        async with (
            httpx.AsyncClient(
                timeout=timeout_s, follow_redirects=False, transport=transport
            ) as client,
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
