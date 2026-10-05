# 0005 — Elección del método de detección y volver a detectar

- Estado: aceptada
- Fecha: 2026-10-05

## Contexto

Hay más de un método de detección (visión clásica por saturación, por contraste oscuro y, más
adelante, YOLO + SAHI) y ninguno sirve igual para toda imagen: depende del color del ganado y del
estado del pasto. La persona que carga o revisa un conteo tiene que poder elegir el método y
probar otro si la propuesta es mala, sin perder la trazabilidad.

## Decisión

- **El servicio publica su catálogo** en `GET /v1/detectors` (contrato `DetectorCatalog`): nombre,
  versión, etiqueta y descripción para la UI, disponibilidad y método predeterminado. La web no
  tiene una lista propia de métodos; los no disponibles se muestran deshabilitados y
  `/v1/detect` los rechaza con 422.
- **Se puede volver a detectar mientras no haya revisión humana.** La máquina de estados permite
  `pendiente_revision → procesando` y `error → procesando`. Un conteo `revisado` es definitivo.
- **Al volver a detectar, la propuesta anterior deja de ser la vigente pero no se borra.** Cada
  corrida guarda su JSON en `counts/{id}/model-results/{detector}-{versión}-{hash}.json`. El
  registro del conteo apunta solo a la propuesta vigente.
- Si una corrida falla, el conteo queda en `error` con el mensaje (sin la propuesta anterior como
  vigente) y se puede reintentar con el mismo método o con otro.

## Consecuencias

- Total modelo, versión del detector y parámetros del registro corresponden siempre a la propuesta
  que se revisó, que es la que importa para la auditoría y para el dataset.
- Las marcas que el revisor no haya confirmado se pierden al volver a detectar; la UI lo advierte.
- Añadir un método nuevo solo toca el servicio de detección.
