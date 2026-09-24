# 0002 — Clean Architecture dentro de Next.js

- Estado: aceptada
- Fecha: 2026-09-24

## Contexto

CLAUDE.md §4 pide capas `domain / application / infrastructure / presentation` con la regla
`presentation → application → domain ← infrastructure`. Next.js exige que el App Router viva en
`src/app`, no en `src/presentation`.

## Decisión

- `src/app` contiene solo archivos de enrutamiento (`page.tsx`, `layout.tsx`, `route.ts`) que
  delegan en `src/presentation`. Se considera parte de la capa de presentación.
- La regla de dependencias se **verifica con ESLint** (`no-restricted-imports` por carpeta en
  `apps/web/eslint.config.mjs`):
  - `domain`: solo imports relativos o `@/domain/*`; ningún paquete externo (ni Zod).
  - `application`: solo `domain`; sin Zod, sin contratos, sin Next.
  - `infrastructure`: `domain` + paquetes externos (Zod, `@hatoscan/contracts`).
  - `presentation`: `application` + `domain`.
  - Los `*.test.ts` están exentos.
- El dominio es inmutable: cada transición de `Count` devuelve una instancia nueva y pasa por la
  máquina de estados de `count-status.ts`, única fuente de verdad de las transiciones.
- La validación de datos externos (respuesta del detector, JSON guardados, variables de entorno)
  ocurre en `infrastructure` con los esquemas Zod generados.

## Consecuencias

- La raíz de composición (dónde se instancian adaptadores y casos de uso) todavía no existe:
  depende de los adaptadores de Airtable (D2) y de almacenamiento (D1).
- Cambiar el detector o el almacenamiento no toca `domain` ni `application`.
