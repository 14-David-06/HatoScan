# 0007 — Detección en TypeScript dentro de la app web

- Estado: aceptada
- Fecha: 2026-11-09
- Reemplaza en parte: 0001 (uv y Python), 0003 (generador Python, `DetectRequest`), 0005 (catálogo
  publicado por HTTP) y 0006 (proyecto de Vercel del detector, token compartido, hosts permitidos).

## Contexto

El detector era un servicio FastAPI aparte. En producción solo se ofrecían métodos de IA por API
(Claude y OpenAI). Visión clásica (OpenCV) y YOLO-SAHI (ONNX con pesos COCO sin entrenar, ~75 de
120 búfalas) estaban desactivados.

Mantener ese servicio costaba más de lo que aportaba:

- un segundo proyecto de Vercel;
- un token compartido y una lista de hosts permitidos contra SSRF;
- descargar la foto otra vez por URL firmada;
- contratos generados en dos lenguajes y dos toolchains en CI.

La instrucción fue usar un solo stack: Next.js, Node.js y TypeScript.

## Decisión

- **Se elimina `services/detector` y todo el código Python del repo.**
- **La detección es un adaptador de infraestructura del puerto `Detector`.** `InProcessDetector`
  (`apps/web/src/infrastructure/detector`) elige el método por nombre, valida sus parámetros, mide
  el tiempo y traduce la salida al dominio. Cada método implementa `DetectionMethodAdapter` y se
  registra en `catalog.ts`:
  - `claude-vision` (Claude Opus 5.5, predeterminado) y `claude-vision-sonnet` (Claude Sonnet 5.5);
  - `openai-vision` (GPT-6 Astra) y `openai-vision-sol` (GPT-6.1 Sol).
- **El puerto recibe los bytes de la foto** (`DetectInput.image`). `ProcessCount` los lee con
  `ObjectStorage.get`. Ya no hay URL firmada para el detector ni descarga desde otro servicio.
- **Teselado con `sharp` (libvips).** Decodifica a resolución completa y aplica la orientación EXIF,
  igual que el navegador. Luego recorta cada tesela, la amplía con Catmull-Rom y la codifica en PNG.
  El reparto de núcleos entre teselas es el mismo de la versión Python, así el solape no duplica
  animales. `sharp` ya es la librería de imágenes de Next.js y Next la deja fuera del bundle.
- **Claude con `@anthropic-ai/sdk`.** Usa `beta.messages.parse` con salida estructurada (Zod),
  `thinking: adaptive`, `effort: low` y `fallbacks: "default"` (beta
  `server-side-fallback-2026-07-01`): si el modelo declina una tesela, la API la reintenta con el
  modelo de respaldo dentro de la misma llamada. **OpenAI con `fetch`** a la Responses API, sin
  sumar su SDK por un solo endpoint.
- **Versiones nuevas:** `claude-vision@0.3.0` y `openai-vision@0.2.0`. La decodificación y la
  ampliación pasan de OpenCV a libvips, así que una propuesta nueva no es comparable byte a byte
  con una anterior. El hash sigue siendo SHA-256 del JSON canónico de los parámetros, pero JS
  escribe `2` donde Python escribía `2.0`: el mismo conjunto de parámetros da otro hash que antes.
- **Límite de tiempo propio.** `DETECTOR_TIMEOUT_MS` (780 s por defecto, máximo 790 s) cancela las
  peticiones en curso y deja el conteo en `error`, con el mensaje, antes de que Vercel corte la
  función a los 800 s. Al primer fallo de una tesela se cancelan las demás.
- **Configuración en la app:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DETECTOR_DEFAULT_METHOD`,
  `DETECTOR_ENABLED_METHODS` y `DETECTOR_TIMEOUT_MS`. Desaparecen `DETECTOR_BASE_URL`,
  `DETECTOR_API_TOKEN` y `DETECTOR_ALLOWED_IMAGE_HOSTS`.
- **Contratos:** se retiran `DetectRequest` y `DetectorCatalog`, que solo existían para el HTTP
  entre la web y el detector. `CountResult`, `ReviewResult`, `Detection` e `ImageInfo` siguen
  siendo la fuente de verdad de los JSON guardados y del dataset.
- **La regla de CLAUDE.md §9 se mantiene en su intención.** Ningún route handler contiene lógica de
  detección: la ruta de procesamiento solo llama al caso de uso `ProcessCount`, y la detección vive
  en `infrastructure`, detrás del puerto.

## Consecuencias

- Un solo proyecto de Vercel. La ruta `/api/counts/[id]/process` necesita Vercel Pro
  (`maxDuration = 800`); conviene _Function CPU: Performance_.
- Las llaves de IA pasan al proyecto web. Solo se leen en el servidor (`server-only`).
- La inferencia sigue fuera de Vercel: la hacen Anthropic y OpenAI. El servidor solo decodifica,
  recorta y reúne respuestas. Una foto de 20 MP ocupa ~60 MB en RGB mientras se procesa.
- Ya no hay visión clásica ni YOLO. Un modelo propio (YOLO + SAHI o conteo por puntos) entrará
  como otro `DetectionMethodAdapter`: con `onnxruntime-node` si cabe en los límites de una función,
  o como cliente de un servicio externo si necesita GPU. Esa decisión se toma cuando exista el
  modelo.
- El test del detector clásico contra la foto de referencia (CLAUDE.md §7) deja de aplicar. Los
  métodos se prueban con respuestas simuladas del proveedor. Medir la calidad contra la foto de
  referencia queda pendiente: cuesta dinero en cada corrida, así que no va en CI.
- Si las detecciones largas se vuelven frecuentes, la salida sigue siendo procesar en segundo plano
  (ADR 0006).
