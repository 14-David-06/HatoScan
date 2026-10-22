from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.config import Settings, get_settings


def require_api_token(
    request: Request, settings: Annotated[Settings, Depends(get_settings)]
) -> None:
    """Exige ``Authorization: Bearer <DETECTOR_API_TOKEN>``. Comparación en tiempo constante."""
    if settings.api_token is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "DETECTOR_API_TOKEN is not configured"
        )
    header = request.headers.get("authorization", "")
    scheme, _, received = header.partition(" ")
    expected = settings.api_token.get_secret_value()
    if scheme.lower() != "bearer" or not secrets.compare_digest(received.strip(), expected):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid or missing API token",
            headers={"WWW-Authenticate": "Bearer"},
        )
