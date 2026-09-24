# `src/app` — solo enrutamiento

Next.js exige que el App Router viva en `src/app`. Esta carpeta es parte de la capa de
**presentación** y debe mantenerse delgada: cada `page.tsx` / `route.ts` solo delega en
`src/presentation` (pantallas, handlers) y en los casos de uso de `src/application`.

Nada de lógica de negocio ni de detección aquí. Ver `docs/adr/0002-clean-architecture-in-next.md`.
