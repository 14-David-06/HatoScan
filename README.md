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

Copia `apps/web/.env.example` → `apps/web/.env.local` y `services/detector/.env.example` →
`services/detector/.env`.

## Contratos

Edita `packages/contracts/schemas/*.schema.json` y regenera ambos lados:

```sh
npm run contracts:generate
sh services/detector/scripts/generate_contracts.sh
```
