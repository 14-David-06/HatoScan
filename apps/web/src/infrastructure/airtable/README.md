# Adaptador Airtable (pendiente)

Aquí vivirá `AirtableCountRepository`, que implementa los puertos `CountRepository` y
`CountIdGenerator` del dominio. Mientras tanto, en local se usa `JsonFileCountRepository`
(`../counts/`), que ya tiene la forma de fila esperada.

Bloqueado por:

- **D2** — qué base usar (nueva de ganadería o tabla en una existente).
- **D3** — de dónde sale el potrero (GeoMaps o catálogo propio), que define la FK simbólica.

Reglas al implementarlo (ver `CLAUDE.md` §6):

- Una fila por conteo, nunca por animal. Nada de binarios: solo claves/URLs del almacenamiento.
- Validar cada registro leído con Zod antes de reconstruir el `Count`.
- Revisar las automatizaciones de la base antes de escribir para no duplicar registros.
