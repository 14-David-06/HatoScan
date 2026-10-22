"""Detector de IA: red neuronal YOLOX (ONNX) con inferencia por teselas al estilo SAHI.

Los animales miden 10-20 px en la foto original, demasiado poco para una red que ve la imagen
entera a 640 px. Se recorre la foto a resolución completa en teselas solapadas, cada tesela se
amplía a la entrada de la red y las cajas se devuelven en píxeles de la imagen original. Las
detecciones repetidas en el solape se fusionan con NMS.

Los pesos son intercambiables: hoy, YOLOX-S preentrenado en COCO (Apache-2.0), que reconoce
vacas, ovejas y caballos pero no fue entrenado con vistas cenitales de dron; mañana, un modelo
entrenado con las revisiones propias, exportado a ONNX con la misma salida.
"""

from __future__ import annotations

import hashlib
import threading
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import onnxruntime as ort
from cv2.typing import MatLike
from numpy.typing import NDArray
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.detectors.classic_cv import decode
from app.domain.detector import DetectorError, DetectorOutput, InvalidParamsError, RawDetection

# Índices COCO de los animales de pastoreo y de cuerpo grande con los que se confunde una búfala
# vista desde arriba: caballo, oveja, vaca, elefante.
COCO_GRAZING_CLASSES = (17, 18, 19, 20)
STRIDES = (8, 16, 32)
PAD_VALUE = 114

FloatArray = NDArray[np.float32]


class YoloSahiParams(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    # Lado de la tesela en píxeles de la imagen original. Se amplía a la entrada de la red
    # (640 px): con 320 px, un animal de 15 px llega a la red con 30 px.
    tile_px: int = Field(320, ge=64, le=2048)
    overlap: float = Field(0.25, ge=0.0, le=0.5)
    # Bajo a propósito: el modelo general da puntajes bajos a animales vistos desde arriba, y
    # el revisor descarta lo que sobre. Por debajo de 0.1 aparecen parches de suelo.
    score_threshold: float = Field(0.1, gt=0.0, lt=1.0)
    nms_iou: float = Field(0.45, gt=0.0, lt=1.0)
    class_ids: tuple[int, ...] = Field(COCO_GRAZING_CLASSES, min_length=1)


class YoloSahiDetector:
    name = "yolo-sahi"
    version = "0.1.0"
    label = "IA · YOLOX + teselas (SAHI)"
    description = (
        "Red neuronal que recorre la foto en teselas a resolución completa y propone una caja "
        "por animal. Hoy usa un modelo general preentrenado (no entrenado con fotos de dron): "
        "revisa con cuidado. Mejorará al entrenarlo con las revisiones."
    )

    def __init__(self, model_path: Path) -> None:
        self._model_path = model_path
        self._session: ort.InferenceSession | None = None
        self._model_sha256: str | None = None
        self._lock = threading.Lock()

    @property
    def available(self) -> bool:
        return self._model_path.is_file()

    def resolve_params(self, params: dict[str, Any] | None) -> dict[str, Any]:
        try:
            resolved = YoloSahiParams.model_validate(params or {}).model_dump(mode="json")
        except ValidationError as exc:
            raise InvalidParamsError(str(exc)) from exc
        # Los pesos forman parte de los parámetros: cambiar de modelo cambia el hash (trazabilidad).
        return {**resolved, "model": self._model_path.name, "model_sha256": self._sha256()}

    def detect(self, image: bytes, params: dict[str, Any]) -> DetectorOutput:
        p = YoloSahiParams.model_validate(
            {k: v for k, v in params.items() if k not in ("model", "model_sha256")}
        )
        session = self._load()
        input_name: str = session.get_inputs()[0].name
        input_size = int(session.get_inputs()[0].shape[2])

        bgr = decode(image)
        height, width = bgr.shape[:2]
        boxes: list[FloatArray] = []
        scores: list[FloatArray] = []
        for x0, y0 in tile_origins(width, height, p.tile_px, p.overlap):
            tile = bgr[y0 : y0 + p.tile_px, x0 : x0 + p.tile_px]
            blob, ratio = preprocess(tile, input_size)
            raw = session.run(None, {input_name: blob})[0][0]
            tile_boxes, tile_scores = decode_yolox(raw, input_size, p)
            if len(tile_scores):
                # Cajas de la entrada de la red → píxeles de la imagen original.
                tile_boxes = tile_boxes / ratio + np.array([x0, y0, 0, 0], dtype=np.float32)
                boxes.append(tile_boxes)
                scores.append(tile_scores)

        detections: list[RawDetection] = []
        if boxes:
            all_boxes = np.concatenate(boxes)
            all_scores = np.concatenate(scores)
            for i in nms(all_boxes, all_scores, p.score_threshold, p.nms_iou):
                x, y, w, h = clip_box(all_boxes[i], width, height)
                if w > 0 and h > 0:
                    detections.append(
                        RawDetection(x=x, y=y, kind="caja", w=w, h=h, score=float(all_scores[i]))
                    )
        return DetectorOutput(width=width, height=height, detections=detections)

    def _load(self) -> ort.InferenceSession:
        with self._lock:
            if self._session is None:
                if not self.available:
                    raise DetectorError(f"Model weights not found at {self._model_path}")
                self._session = ort.InferenceSession(
                    str(self._model_path), providers=["CPUExecutionProvider"]
                )
            return self._session

    def _sha256(self) -> str:
        if self._model_sha256 is None:
            if not self.available:
                raise DetectorError(f"Model weights not found at {self._model_path}")
            self._model_sha256 = hashlib.sha256(self._model_path.read_bytes()).hexdigest()
        return self._model_sha256


def tile_origins(width: int, height: int, tile: int, overlap: float) -> list[tuple[int, int]]:
    """Esquinas de teselas solapadas que cubren toda la imagen; la última se pega al borde."""

    def axis(length: int) -> list[int]:
        if length <= tile:
            return [0]
        stride = max(1, int(tile * (1 - overlap)))
        starts = list(range(0, length - tile, stride))
        return [*starts, length - tile]

    return [(x, y) for y in axis(height) for x in axis(width)]


def preprocess(tile: MatLike, size: int) -> tuple[FloatArray, float]:
    """Amplía la tesela a la entrada de la red conservando la proporción (relleno 114)."""
    h, w = tile.shape[:2]
    ratio = min(size / h, size / w)
    resized = cv2.resize(tile, (int(w * ratio), int(h * ratio)), interpolation=cv2.INTER_LINEAR)
    padded = np.full((size, size, 3), PAD_VALUE, dtype=np.uint8)
    padded[: resized.shape[0], : resized.shape[1]] = resized
    blob = padded.transpose(2, 0, 1)[np.newaxis].astype(np.float32)
    return np.ascontiguousarray(blob), ratio


def decode_yolox(raw: FloatArray, size: int, p: YoloSahiParams) -> tuple[FloatArray, FloatArray]:
    """Salida cruda de YOLOX (anclas x [cx, cy, w, h, obj, clases...]) → cajas xywh y puntajes."""
    grids: list[FloatArray] = []
    strides: list[FloatArray] = []
    for stride in STRIDES:
        cells = size // stride
        xv, yv = np.meshgrid(np.arange(cells), np.arange(cells))
        grids.append(np.stack((xv, yv), axis=2).reshape(-1, 2).astype(np.float32))
        strides.append(np.full((cells * cells, 1), stride, dtype=np.float32))
    grid = np.concatenate(grids)
    stride_col = np.concatenate(strides)

    centers = (raw[:, :2] + grid) * stride_col
    sizes = np.exp(raw[:, 2:4]) * stride_col
    class_scores = raw[:, 5:][:, list(p.class_ids)] * raw[:, 4:5]
    best = class_scores.max(axis=1)
    keep = best >= p.score_threshold
    boxes = np.concatenate((centers[keep] - sizes[keep] / 2, sizes[keep]), axis=1)
    return boxes.astype(np.float32), best[keep].astype(np.float32)


def nms(boxes: FloatArray, scores: FloatArray, score_threshold: float, iou: float) -> list[int]:
    kept = cv2.dnn.NMSBoxes(boxes.tolist(), scores.tolist(), score_threshold, iou)
    return [int(i) for i in np.array(kept).reshape(-1)]


def clip_box(box: FloatArray, width: int, height: int) -> tuple[float, float, float, float]:
    x1 = float(max(0.0, box[0]))
    y1 = float(max(0.0, box[1]))
    x2 = float(min(float(width), box[0] + box[2]))
    y2 = float(min(float(height), box[1] + box[3]))
    return x1, y1, x2 - x1, y2 - y1
