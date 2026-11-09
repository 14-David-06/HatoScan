# HatoScan

Conteo de ganado (búfalas, bovinos) en fotos aéreas de dron para Sirius Verse. Un detector propone
el conteo y **una persona siempre lo confirma**; el total revisado es el dato oficial.

Contexto completo, principios y decisiones abiertas: [`CLAUDE.md`](CLAUDE.md).

## Estructura

```
apps/web            Next.js (App Router) — UI de revisión y detección con IA. Clean Architecture.
packages/contracts  JSON Schema compartidos (fuente de verdad) + validadores Zod generados.
docs/               ADRs y documentación.
```

## Requisitos

Node 22+ y npm 11. Todo el proyecto es TypeScript.

## Comandos

```sh
npm install                 # dependencias TS (todos los workspaces)
npm run dev                 # web en http://localhost:3000
npm test                    # tests TS
npm run lint && npm run typecheck
```

Copia `apps/web/.env.example` → `apps/web/.env.local` y rellena `LOCAL_STORAGE_SIGNING_SECRET`,
`AUTH_SESSION_SECRET` y al menos una llave de IA (`ANTHROPIC_API_KEY` u `OPENAI_API_KEY`).

## Flujo local

1. `npm run dev`.
2. En http://localhost:3000 → **Nuevo conteo**: sube la foto original con potrero, especie, fecha y
   **método de detección** (ver [Detección](#detección)).
3. La app guarda la imagen, corre la detección y abre la **pantalla de revisión**: clic para añadir
   un animal, clic en una marca del modelo para descartarla o restaurarla, Ctrl+Z para deshacer.
   Si la propuesta es mala, **Volver a detectar con otro método** (solo antes de confirmar).
4. **Confirmar conteo** guarda el JSON revisado; el total revisado pasa a ser el oficial.

En local (`STORAGE_DRIVER=local`), imágenes y JSON viven en `apps/web/.data/` (ver
[ADR 0004](docs/adr/0004-raiz-de-composicion-y-adaptadores-locales.md)). En producción van a un
bucket S3 privado; ver [ADR 0006](docs/adr/0006-despliegue-vercel-y-s3.md) y
[`docs/despliegue.md`](docs/despliegue.md).

## Detección

Corre en el servidor de la app, detrás del puerto `Detector`
([ADR 0007](docs/adr/0007-deteccion-en-typescript-dentro-de-la-web.md)). La foto se recorta en
teselas a resolución completa, cada tesela se amplía y se envía a un modelo de visión, y los puntos
vuelven a píxeles de la imagen original. El código está en
[`apps/web/src/infrastructure/detector`](apps/web/src/infrastructure/detector).

| Método                 | Qué es                                                                         |
| ---------------------- | ------------------------------------------------------------------------------ |
| `claude-vision`        | Claude Opus 5.5. Predeterminado. Teselas de 1024 px ampliadas 2x, 16 a la vez. |
| `claude-vision-sonnet` | Claude Sonnet 5.5: más rápido y económico.                                     |
| `openai-vision`        | GPT-6 Astra. Teselas de 512 px ampliadas 1,5x, coordenadas normalizadas.       |
| `openai-vision-sol`    | GPT-6.1 Sol: equilibra precisión y costo.                                      |

Referencia medida con la versión Python anterior (`claude-vision@0.2.0`, mismo algoritmo): en la
foto de prueba de 120 búfalas propuso 120, en su sitio, en unos 37 s y 0,20 USD por foto de 2 MP;
una foto de 20 MP tarda 2–4 min. Para añadir un método, implementa `DetectionMethodAdapter` y
regístralo en `catalog.ts`.

## Contratos

Edita `packages/contracts/schemas/*.schema.json` y regenera los validadores Zod:

```sh
npm run contracts:generate
```
