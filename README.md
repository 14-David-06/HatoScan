# HatoScan

Conteo de ganado (búfalas, bovinos) en fotos aéreas de dron para Sirius Verse. Un detector propone
el conteo y **una persona siempre lo confirma**; el total revisado es el dato oficial.

Contexto completo, principios y decisiones abiertas: [`CLAUDE.md`](CLAUDE.md).

## Estructura

```
apps/web            Next.js (App Router) — UI de revisión y orquestación. Clean Architecture.
services/detector   FastAPI en Vercel (proyecto aparte) — detección sobre la imagen a resolución completa.
packages/contracts  JSON Schema compartidos (fuente de verdad) + validadores Zod generados.
docs/               ADRs y documentación.
```

## Requisitos

Node 22+, npm 11, Python 3.11+ y [uv](https://docs.astral.sh/uv/).

## Comandos

```sh
npm install                 # dependencias TS (todos los workspaces)
npm run dev                 # web en http://localhost:3000
npm test                    # tests TS
npm run lint && npm run typecheck

cd services/detector
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest
```

Copia `apps/web/.env.example` → `apps/web/.env.local` (rellena `LOCAL_STORAGE_SIGNING_SECRET`) y
`services/detector/.env.example` → `services/detector/.env`.

## Flujo local

1. `npm run dev` y el detector en `:8000`.
2. En http://localhost:3000 → **Nuevo conteo**: sube la foto original con potrero, especie, fecha y
   **método de detección** (la lista la publica el servicio; ver `services/detector/README.md`).
3. La app guarda la imagen, llama al detector y abre la **pantalla de revisión**: clic para añadir
   un animal, clic en una marca del modelo para descartarla o restaurarla, Ctrl+Z para deshacer.
   Si la propuesta es mala, **Volver a detectar con otro método** (solo antes de confirmar).
4. **Confirmar conteo** guarda el JSON revisado; el total revisado pasa a ser el oficial.

En local (`STORAGE_DRIVER=local`), imágenes y JSON viven en `apps/web/.data/` (ver
[ADR 0004](docs/adr/0004-raiz-de-composicion-y-adaptadores-locales.md)). En producción van a un
bucket S3 privado; ver [ADR 0006](docs/adr/0006-despliegue-vercel-y-s3.md) y
[`docs/despliegue.md`](docs/despliegue.md).

## Contratos

Edita `packages/contracts/schemas/*.schema.json` y regenera ambos lados:

```sh
npm run contracts:generate
sh services/detector/scripts/generate_contracts.sh
```
