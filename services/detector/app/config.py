from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, SecretStr
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
    # Métodos que se ofrecen, en JSON (ej. ["claude-vision"]). Sin valor, se ofrecen todos.
    # El código de los demás se conserva: se reactivan cuando haya un modelo entrenado.
    enabled_detectors: list[str] | None = None
    # Pesos ONNX del detector de IA (yolo-sahi). Sin archivo, el método se lista como no disponible.
    yolo_model_path: Path = Path("models/yolox_s.onnx")
    # Llave de la API de Claude (método claude-vision). Sin ella, el método no está disponible.
    anthropic_api_key: SecretStr | None = Field(
        None, validation_alias=AliasChoices("ANTHROPIC_API_KEY", "DETECTOR_ANTHROPIC_API_KEY")
    )
    # Llave de la API de OpenAI (métodos openai-*). Sin ella, esos métodos no están disponibles.
    openai_api_key: SecretStr | None = Field(
        None, validation_alias=AliasChoices("OPENAI_API_KEY", "DETECTOR_OPENAI_API_KEY")
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
