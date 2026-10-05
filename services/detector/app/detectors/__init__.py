from app.detectors.classic_cv import ClassicCvDarkDetector, ClassicCvDetector
from app.detectors.yolo_sahi import YoloSahiDetector
from app.domain.detector import Detector


def build_registry() -> dict[str, Detector]:
    """Detectores por nombre, en el orden en que se ofrecen. Los no disponibles se listan para que
    la UI los muestre, pero ``/v1/detect`` los rechaza."""
    detectors: list[Detector] = [ClassicCvDetector(), ClassicCvDarkDetector(), YoloSahiDetector()]
    return {detector.name: detector for detector in detectors}
