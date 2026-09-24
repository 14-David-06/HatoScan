from app.detectors.classic_cv import ClassicCvDetector
from app.domain.detector import Detector


def build_registry() -> dict[str, Detector]:
    """Detectores disponibles por nombre. Los stubs no se registran hasta estar listos."""
    detectors: list[Detector] = [ClassicCvDetector()]
    return {detector.name: detector for detector in detectors}
