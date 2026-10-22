from app.config import get_settings
from app.detectors.classic_cv import ClassicCvDarkDetector, ClassicCvDetector
from app.detectors.claude_vision import ClaudeVisionDetector
from app.detectors.openai_vision import OpenAiVisionDetector
from app.detectors.yolo_sahi import YoloSahiDetector
from app.domain.detector import Detector


def build_registry() -> dict[str, Detector]:
    """Detectores por nombre, en el orden en que se ofrecen. Los no disponibles se listan para que
    la UI los muestre, pero ``/v1/detect`` los rechaza."""
    settings = get_settings()
    api_key = settings.anthropic_api_key.get_secret_value() if settings.anthropic_api_key else None
    openai_key = settings.openai_api_key.get_secret_value() if settings.openai_api_key else None
    detectors: list[Detector] = [
        ClassicCvDetector(),
        ClassicCvDarkDetector(),
        YoloSahiDetector(settings.yolo_model_path),
        ClaudeVisionDetector(api_key),
        ClaudeVisionDetector(
            api_key,
            name="claude-vision-sonnet",
            model="claude-sonnet-5-5",
            label="IA · Claude Sonnet 5.5 (Anthropic)",
            description=(
                "Modelo de Anthropic más rápido y económico que Opus, con muy buena visión. "
                "Revisa la foto por partes y marca cada animal."
            ),
        ),
        OpenAiVisionDetector(
            openai_key,
            name="openai-vision",
            model="gpt-6-astra",
            label="IA · GPT-6 Astra (OpenAI)",
            description=(
                "El modelo insignia de OpenAI revisa la foto por partes y marca cada animal. "
                "No necesita entrenamiento; cuesta por foto y tarda unos minutos."
            ),
        ),
        OpenAiVisionDetector(
            openai_key,
            name="openai-vision-sol",
            model="gpt-6.1-sol",
            label="IA · GPT-6.1 Sol (OpenAI)",
            description=(
                "Modelo de OpenAI que equilibra precisión y costo. Revisa la foto por partes y "
                "marca cada animal."
            ),
        ),
    ]
    enabled = settings.enabled_detectors
    return {d.name: d for d in detectors if enabled is None or d.name in enabled}
