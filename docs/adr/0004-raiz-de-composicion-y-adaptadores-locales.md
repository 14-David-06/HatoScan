# 0004 — Raíz de composición y adaptadores locales de desarrollo

- Estado: aceptada
- Fecha: 2026-10-05

## Contexto

La pantalla de revisión y el flujo subir → procesar → revisar se pueden construir ya, pero los
adaptadores definitivos están bloqueados por decisiones abiertas: almacenamiento de imágenes (D1),
base de Airtable (D2), fuente de potreros (D3) y autenticación (D4). El ADR 0002 dejó pendiente
dónde se instancian los adaptadores.

## Decisión

- **Raíz de composición en `apps/web/src/composition/container.ts`.** Es el único lugar que elige
  adaptadores concretos. Solo la importa `src/app` (rutas); ESLint impide que `domain`,
  `application`, `infrastructure` o `presentation` la importen.
- **Adaptadores locales, solo para desarrollo**, detrás de los puertos existentes:
  - `LocalFsObjectStorage` (`ObjectStorage`): guarda en `LOCAL_DATA_DIR/objects`, sin reescalar.
    Sus URLs de lectura caducan y van firmadas con HMAC-SHA256, servidas por `/api/files/...`;
    así el detector y el navegador las consumen igual que consumirán las del proveedor final.
  - `JsonFileCountRepository` (`CountRepository` + `CountIdGenerator`): una fila por conteo en
    `LOCAL_DATA_DIR/counts.json`, validada con Zod al leer, con la misma forma que tendrá la tabla
    `Conteos` de Airtable. Escritura atómica y serializada dentro del proceso.
- **Route handlers delgados.** `src/app/api/**/route.ts` solo conecta el contenedor con los handlers
  de `src/presentation/http`, que validan la entrada con Zod y traducen errores de dominio a HTTP
  (400 entrada inválida, 404 no existe, 422 regla de dominio, 500 lo demás).
- **Revisor temporal.** Mientras se decide D4, el revisor escribe su `SIRIUS-PER-XXXX` en la
  pantalla de revisión y el servidor lo valida. Se reemplaza por la sesión al cerrar D4.

## Consecuencias

- Al cerrar D1 y D2 se añaden los adaptadores reales y se cambia solo `container.ts`.
- Los adaptadores locales no sirven en Vercel (disco efímero y de solo lectura). No se deben
  desplegar.
- **Límite de carga en Vercel:** el cuerpo de una función está limitado a 4,5 MB y las fotos pesan
  10–30 MB. En producción la imagen debe subir directo al storage con una URL firmada de escritura
  (nuevo método del puerto `ObjectStorage`), no a través de `POST /api/counts`. Se resuelve junto
  con D1.
- La detección corre de forma síncrona dentro de `POST /api/counts/{id}/process`
  (`maxDuration = 300`). Si las fotos grandes superan ese tiempo, pasar a una cola (Cloud Tasks o
  similar) con el conteo en `procesando`.
