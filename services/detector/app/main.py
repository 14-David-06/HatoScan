from fastapi import FastAPI

from app.api.routes import router
from app.detectors import build_registry
from app.domain.detector import Detector


def create_app(detectors: dict[str, Detector] | None = None) -> FastAPI:
    app = FastAPI(title="HatoScan Detector", version="0.1.0")
    app.state.detectors = detectors if detectors is not None else build_registry()
    app.include_router(router)
    return app


app = create_app()
