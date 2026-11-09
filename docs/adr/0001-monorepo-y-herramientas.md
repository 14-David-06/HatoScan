# 0001 — Monorepo y herramientas

- Estado: aceptada. La parte de Python (`uv`, `services/detector`) quedó sin efecto por el ADR 0007:
  el repo es solo TypeScript.
- Fecha: 2026-09-24

## Contexto

El producto tiene dos runtimes (Next.js en Vercel y Python en Cloud Run) que comparten contratos.
Queremos un solo repo, cambios atómicos entre web, detector y contratos, y pocas herramientas nuevas.

## Decisión

- **npm workspaces** (`apps/*`, `packages/*`) para TypeScript. No se introduce pnpm ni Turborepo:
  con dos paquetes no compensan otra herramienta. Se puede revisar si crece el número de paquetes.
- **uv** para el servicio Python (`services/detector`), con `uv.lock` versionado.
- **TypeScript fijado en `~6.0`**: `typescript-eslint` aún no soporta TS ≥ 6.1 (el `latest` es 7.x).
- Node 22 (`.nvmrc`), Python 3.12 en la imagen (`requires-python >= 3.11`).
- Finales de línea LF en todo el repo (`.gitattributes`), aunque se desarrolle en Windows.

## Consecuencias

- `npm install` en la raíz instala todo el lado TS; `uv sync` en `services/detector` el lado Python.
- Las imágenes de dron no entran en git (`.gitignore`). La foto de referencia para el test del
  detector clásico necesita otra vía (pendiente, ver 0003 y CLAUDE.md §7).
