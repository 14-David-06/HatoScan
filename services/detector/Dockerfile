# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
WORKDIR /srv

# Dependencias primero para aprovechar la caché de capas.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app

# Pesos del detector de IA (YOLOX-S, COCO, Apache-2.0). Mismo origen y hash que
# scripts/download_model.sh; el build falla si el archivo no coincide.
ARG YOLO_MODEL_URL=https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_s.onnx
ARG YOLO_MODEL_SHA256=c5c2d13e59ae883e6af3b45daea64af4833a4951c92d116ec270d9ddbe998063
RUN python -c "import hashlib, os, sys, urllib.request; os.makedirs('models', exist_ok=True); data = urllib.request.urlopen(sys.argv[1], timeout=120).read(); assert hashlib.sha256(data).hexdigest() == sys.argv[2], 'model checksum mismatch'; open('models/yolox_s.onnx', 'wb').write(data)" "$YOLO_MODEL_URL" "$YOLO_MODEL_SHA256"

RUN useradd --system --uid 10001 detector
USER detector

# Para correrlo en contenedor (en producción se despliega en Vercel, ADR 0006). PORT se puede inyectar.
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "exec /srv/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
