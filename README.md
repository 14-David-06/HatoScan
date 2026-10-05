# HatoScan

Conteo de ganado (búfalas, bovinos) en fotos aéreas de dron para Sirius Verse. Un detector propone
el conteo y **una persona siempre lo confirma**; el total revisado es el dato oficial.

Contexto completo, principios y decisiones abiertas: [`CLAUDE.md`](CLAUDE.md).

## Estructura

```
apps/web            Next.js (App Router) — UI de revisión y orquestación. Clean Architecture.
services/detector   FastAPI en Cloud Run — detección sobre la imagen a resolución completa.
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
2. En http://localhost:3000 → **Nuevo conteo**: sube la foto original con potrero, especie y fecha.
3. La app guarda la imagen, llama al detector y abre la **pantalla de revisión**: clic para añadir
   un animal, clic en una marca del modelo para descartarla o restaurarla, Ctrl+Z para deshacer.
4. **Confirmar conteo** guarda el JSON revisado; el total revisado pasa a ser el oficial.

En local, imágenes, JSON y registro de conteos viven en `apps/web/.data/` (ver
[ADR 0004](docs/adr/0004-raiz-de-composicion-y-adaptadores-locales.md)); Airtable y el storage
definitivo esperan las decisiones D1/D2.

## Contratos

Edita `packages/contracts/schemas/*.schema.json` y regenera ambos lados:

```sh
npm run contracts:generate
sh services/detector/scripts/generate_contracts.sh
```
