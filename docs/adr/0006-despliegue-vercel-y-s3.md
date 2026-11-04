# 0006 — Despliegue en Vercel con imágenes en S3 privado

- Estado: aceptada
- Fecha: 2026-11-04

## Contexto

El plan inicial (CLAUDE.md §3) era la web en Vercel y el detector en Google Cloud Run. No hay
cuenta de GCP disponible. Hay Vercel y AWS. Se descartó correr el detector en AWS (Lambda o
Fargate detrás de una cola) por costo y por la operación que añade. La instrucción fue usar
Vercel para todo y AWS solo para almacenar en S3.

Además, D1 (almacenamiento de imágenes) seguía abierta, y el ADR 0004 dejó dos problemas para
producción: los adaptadores locales no sirven en Vercel, y las fotos de 10–30 MB superan el
límite de 4,5 MB por cuerpo de petición de las funciones.

## Decisión

- **D1 cerrada: bucket S3 privado** en la cuenta de AWS de Sirius Regenerative.
  `S3ObjectStorage` implementa el puerto `ObjectStorage`. Tiene Block Public Access, cifrado
  SSE-S3, una política que solo acepta HTTPS y CORS solo para el origen de la app. Todo acceso
  usa URLs firmadas que caducan.
- **Subida directa al bucket.** El puerto `ObjectStorage` gana `getUploadUrl`, `stat`, `copy` y
  `delete`. El flujo es:
  1. `POST /api/counts/uploads` entrega una URL `PUT` firmada para `uploads/{uuid}.{ext}`.
  2. El navegador sube la foto ahí, con progreso.
  3. `POST /api/counts` (JSON, con `uploadKey`) verifica el objeto: existe, el tipo coincide y
     pesa como máximo 80 MB. Lo copia dentro del bucket a `counts/{id}/original.{ext}` sin tocar
     sus bytes y registra el conteo.

  Las subidas que nunca se registran se borran a las 24 h con una regla de ciclo de vida.
  `LocalFsObjectStorage` imita el mismo flujo con `PUT /api/files/...` para el desarrollo.

- **Dos proyectos de Vercel sobre el mismo repo:**
  - `apps/web` (Next.js).
  - `services/detector` (FastAPI como función Python, `vercel.json`).

  El detector sigue siendo un servicio aparte, detrás del puerto `Detector` y de `HttpDetector`.
  La lógica de detección no entra a los route handlers de Next. Esto reemplaza la regla «la
  inferencia no corre en funciones serverless de Vercel».

- **Detección síncrona** con `maxDuration = 800` en la ruta de procesamiento y en el detector.
  Es el máximo de Vercel Pro con fluid compute. El detector descarga la imagen directo de S3 con
  la URL firmada. `DETECTOR_ALLOWED_IMAGE_HOSTS` solo acepta el host del bucket.
- **Credenciales:** un usuario IAM `hatoscan-web` con permisos solo sobre `counts/*` y
  `uploads/*` del bucket. Sus llaves van en variables `S3_*`, porque Vercel reserva los nombres
  `AWS_*`. El detector no tiene credenciales de AWS.

## Consecuencias

- **Vercel Pro es obligatorio.** El plan Hobby no permite uso comercial, y su límite de 300 s se
  queda corto para `claude-vision` en fotos de 20 MP (2–4 min).
- **El detector en Vercel corre solo en CPU**, con 2 vCPU y 4 GB como máximo. En producción se
  ofrecen los métodos por API: `claude-vision` y `openai-*`. `yolo-sahi` aparece como «no
  disponible» porque los pesos ONNX no se versionan ni se despliegan. Cuando haya un modelo
  entrenado, se evaluará si cabe en esos límites o si necesita GPU fuera de Vercel.
- La web deja de esperar a los 780 s (`DETECTOR_TIMEOUT_MS`). Así alcanza a dejar el conteo en
  `error`, con el mensaje, antes de que Vercel corte la función a los 800 s. Si una función se
  cortara antes de guardar, el conteo quedaría en `procesando` sin poder volver a detectarse. Si
  las detecciones largas se vuelven frecuentes, la salida es procesar en segundo plano: el
  conteo queda en `procesando` y la pantalla consulta su estado.
- El limitador de intentos de login sigue en memoria por instancia. Es aceptable por ahora.
- Las llaves de IAM son de larga duración. Rotarlas es un paso manual (ver
  `docs/despliegue.md`). Reemplazarlas por OIDC de Vercel con un rol de IAM queda como mejora.
