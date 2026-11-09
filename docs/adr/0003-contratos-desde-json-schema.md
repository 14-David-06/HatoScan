# 0003 — Contratos generados desde JSON Schema

- Estado: aceptada. El generador Python y el contrato `DetectRequest` se retiraron en el ADR 0007; los
  JSON Schema siguen siendo la fuente de verdad de los validadores Zod.
- Fecha: 2026-09-24

## Contexto

La web (TS) y el detector (Python) intercambian `DetectRequest` y `CountResult`, y los JSON guardados
(`CountResult`, `ReviewResult`) son el insumo del dataset de entrenamiento. Deben coincidir siempre.

## Decisión

- La fuente de verdad son los archivos de `packages/contracts/schemas/*.schema.json` (draft 2020-12).
- TS: `json-schema-to-zod` (vía `scripts/generate-zod.mjs`) → `packages/contracts/src/generated`.
  `z.any()` se reemplaza por `z.unknown()` para no filtrar `any`.
- Python: `datamodel-code-generator` (vía `services/detector/scripts/generate_contracts.sh`) →
  `services/detector/app/contracts`, modelos Pydantic v2 con `extra="forbid"`.
- El código generado se versiona; CI regenera y falla si hay diferencias.
- Nombres de campos: los de la detección siguen literalmente CLAUDE.md §5 (`tipo`, `origen`,
  `estado`, y sus valores en español). Los campos que el documento no define van en inglés
  (`image_url`, `detector_version`, `params_hash`, ...).
- Las reglas que JSON Schema expresa mal (una `caja` exige `w`/`h`; coordenadas dentro de la
  imagen) se validan en el dominio, no en el esquema.

## Consecuencias

- Cambiar un contrato = editar el schema, ejecutar ambos generadores y ajustar los dos lados en el
  mismo PR.
- Mezcla de idiomas en el JSON (pendiente de confirmar: ver PR del scaffold).
