from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DETECTOR_", env_file=".env", extra="ignore")

    # Fotos de dron de 10-30 MB; margen para mosaicos.
    max_image_bytes: int = 80 * 1024 * 1024
    image_download_timeout_s: float = 60.0
    default_detector: str = "classic-cv"


@lru_cache
def get_settings() -> Settings:
    return Settings()
