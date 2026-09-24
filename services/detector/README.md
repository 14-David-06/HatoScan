# Servicio de detección

FastAPI en Cloud Run. Recibe una URL firmada de la imagen original, ejecuta un detector y
devuelve un `CountResult` (ver `packages/contracts`). La inferencia nunca corre en Vercel.

## Desarrollo

```sh
uv sync
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

## Añadir un detector

1. Implementar el protocolo `Detector` de `app/domain/detector.py` en `app/detectors/`.
2. Registrarlo en `app/detectors/__init__.py`.
3. La imagen llega a resolución completa: no reescalar (los animales miden 10–20 px).
