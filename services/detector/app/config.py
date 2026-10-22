from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DETECTOR_", env_file=".env", extra="ignore")

    # Token compartido que la web manda en `Authorization: Bearer`. Sin él, ``/v1/*`` responde 503:
    # el servicio no se expone nunca sin autenticación.
    api_token: SecretStr | None = None
    # Hosts de los que se aceptan URLs de imagen, en JSON (ej. ["hatoscan.vercel.app"]). Vacío =
    # ninguno: el detector solo descarga de la app, nunca de direcciones arbitrarias (SSRF).
    allowed_image_hosts: list[str] = []

    # Fotos de dron de 10-30 MB; margen para mosaicos.
    max_image_bytes: int = 80 * 1024 * 1024
    image_download_timeout_s: float = 60.0
    default_detector: str = "classic-cv"


@lru_cache
def get_settings() -> Settings:
    return Settings()
