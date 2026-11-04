# Servicio de detección

FastAPI, desplegado como proyecto aparte de Vercel (ADR 0006, `docs/despliegue.md`). Recibe una URL
firmada de la imagen original en S3, ejecuta un detector y devuelve un `CountResult` (ver
`packages/contracts`). La web nunca ejecuta detección.

## Desarrollo

```sh
uv sync
sh scripts/download_model.sh   # pesos del detector de IA (35 MB, no se versionan)
uv run uvicorn app.main:app --reload --port 8000
uv run pytest
uv run ruff check . && uv run ruff format --check . && uv run mypy app tests
```

Contratos: `app/contracts` se genera desde `packages/contracts/schemas`. No editar a mano:

```sh
sh scripts/generate_contracts.sh
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |
| POST | `/v1/detect` | `DetectRequest` → `CountResult` |

Errores: `422` petición o parámetros no válidos · `502` no se pudo descargar la imagen ·
`500` el detector falló (el mensaje se devuelve tal cual; la web deja el conteo en `error`).

## Métodos

| Nombre | Qué es |
|---|---|
| `classic-cv` | Visión clásica: manchas poco saturadas sobre el pasto. Predeterminado. |
| `classic-cv-dark` | Visión clásica: manchas más oscuras que su entorno. |
| `yolo-sahi` | IA: red YOLOX (ONNX Runtime, CPU) recorriendo la foto en teselas de 320 px solapadas, ampliadas a 640 px. Devuelve cajas. Hoy con pesos COCO preentrenados (vaca, oveja, caballo, elefante), no entrenados con fotos de dron: en la foto de prueba de 120 búfalas propone ~75 sin falsos positivos visibles. Para cambiar de modelo, apunta `DETECTOR_YOLO_MODEL_PATH` a otro ONNX con la misma salida; su SHA-256 entra en los parámetros y en el hash. |

| `claude-vision` | IA: Claude (`claude-opus-5-5`) marca un punto por animal en teselas de 768 px ampliadas 2x, 8 en paralelo. Necesita `ANTHROPIC_API_KEY` en `services/detector/.env`. En la foto de prueba de 120 búfalas propuso 120, en su sitio. Unos 37 s y 0,20 USD por foto de 2 MP; una de 20 MP son unas 40 teselas (~1,4 USD, 2–4 min). |

Tiempo del método YOLOX en CPU (i7-1255U): ~4 s por foto de 2 MP, ~35 s por foto de 20 MP.

## Añadir un detector

1. Implementar el protocolo `Detector` de `app/domain/detector.py` en `app/detectors/`.
2. Registrarlo en `app/detectors/__init__.py`.
3. La imagen llega a resolución completa: no reescalar (los animales miden 10–20 px).
