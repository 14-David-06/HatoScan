#!/bin/sh
# Descarga los pesos del detector de IA (YOLOX-S, COCO, Apache-2.0) y verifica su SHA-256.
# Los pesos no se versionan: pesan 35 MB.
set -eu
cd "$(dirname "$0")/.."
URL="https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_s.onnx"
SHA256="c5c2d13e59ae883e6af3b45daea64af4833a4951c92d116ec270d9ddbe998063"
mkdir -p models
curl -fsSL -o models/yolox_s.onnx.tmp "$URL"
echo "$SHA256  models/yolox_s.onnx.tmp" | sha256sum -c -
mv models/yolox_s.onnx.tmp models/yolox_s.onnx
