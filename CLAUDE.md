# CLAUDE.md — Sirius Conteo de Ganado por Dron

> Contexto permanente del proyecto. Léelo completo antes de cualquier tarea. Si algo aquí contradice una instrucción puntual, pregunta antes de actuar.

## 1. Qué es este proyecto

Aplicación de Sirius Verse para contar animales (búfalas, bovinos) en fotos aéreas de dron tomadas en los potreros de Guaicaramo. El conteo lo propone un detector automático y **siempre lo confirma un humano** en una pantalla de revisión. El total revisado es el dato oficial; el total del modelo es solo una propuesta.

Objetivo de negocio: conteos de inventario ganadero rápidos, auditables (quién revisó, con qué versión del modelo, sobre qué imagen) y que con el uso generen el dataset para entrenar un modelo propio.

## 2. Principios no negociables

1. **Human-in-the-loop.** Ningún conteo se marca como definitivo sin revisión humana. La UI de revisión es parte central del producto, no un extra.
2. **El detector es intercambiable.** El dominio no conoce Claude, OpenAI, YOLO ni ningún proveedor. Existe un puerto `Detector` con implementaciones concretas (hoy: modelos de visión por API, Claude y OpenAI; mañana: un modelo propio, YOLO + SAHI o conteo por puntos).
3. **Trazabilidad total.** Cada conteo guarda: imagen original, JSON de detecciones del modelo, JSON de detecciones revisadas, versión del detector, parámetros usados, revisor y fechas.
4. **Cada corrección es una etiqueta.** Las correcciones del revisor se deben poder exportar como dataset (formato YOLO y COCO) sin trabajo manual.
5. **Airtable guarda registros, no píxeles ni animales.** Nunca una fila por animal. Nunca binarios en Airtable.
6. **Coordenadas siempre en píxeles de la imagen original**, origen arriba-izquierda. Nunca en píxeles de pantalla ni de miniatura.

## 3. Stack

| Capa | Tecnología |
|---|---|
| Frontend + API | Next.js (App Router) + TypeScript estricto, desplegado en Vercel (un solo proyecto) |
| Arquitectura | Clean Architecture (domain / application / infrastructure / presentation) |
| Registro de datos | Airtable (arquitectura federada de Sirius Verse, FK simbólicas) |
| Detección | En el servidor de la app Next.js, como adaptador del puerto `Detector` (`apps/web/src/infrastructure/detector`, ADR 0007): teselas con `sharp` y modelos de visión por API (Claude con `@anthropic-ai/sdk`, OpenAI con `fetch`) |
| Almacenamiento de objetos | Bucket S3 privado en la cuenta de AWS de Sirius Regenerative (D1 cerrada, ADR 0006). AWS se usa **solo** para S3 |
| Validación de contratos | Zod, generado desde JSON Schema (`packages/contracts`) |

Todo el proyecto es TypeScript (Next.js + Node.js); no se agrega Python (ADR 0007). La inferencia la hacen los proveedores de IA; el servidor de la app decodifica la foto, la recorta en teselas y reúne las respuestas. Requiere Vercel Pro: hasta 800 s por función y solo CPU. Un modelo propio que necesite GPU tendrá que vivir fuera de Vercel; esa decisión se toma cuando exista. Despliegue paso a paso: `docs/despliegue.md`.

## 4. Estructura del repo (monorepo)

```
/apps/web                      # Next.js
  /src/domain                  # Entidades, value objects, puertos. Cero dependencias externas.
  /src/application             # Casos de uso. Depende solo de domain.
  /src/infrastructure          # Airtable, storage, detección (métodos de IA en /detector).
  /src/presentation            # App Router, componentes, route handlers.
/packages/contracts            # JSON Schema de Detection, CountResult, etc. Fuente de verdad.
/docs                          # ADRs, especificación, protocolo de captura
```

Regla de dependencias: `presentation → application → domain ← infrastructure`. Domain no importa nada de las otras capas.

## 5. Modelo de dominio

- **Conteo** (`SIRIUS-CONTEO-XXXX`): una foto (o mosaico) de un potrero en una fecha.
- **Estados del conteo:** `subido → procesando → pendiente_revision → revisado`, más `error`. Transiciones validadas en el dominio; cualquier otra transición es un error.
- **Detección:** `{ id, x, y, tipo: "punto" | "caja", w?, h?, score?, origen: "modelo" | "humano", estado: "activa" | "descartada" }`. Las descartadas se conservan (sirven como negativos para entrenar).
- **Versión del detector:** string semántico, ej. `claude-vision@0.3.0` o, a futuro, `yolo11s-sahi@0.3.0`, más un hash de los parámetros.

## 6. Datos en Airtable

Tabla `Conteos` (base por confirmar, ver D2). Campos mínimos:

- ID Conteo (`SIRIUS-CONTEO-XXXX`)
- Finca (texto libre; la app sugiere las ya usadas)
- Potrero (FK simbólica; ver D3)
- Fecha de vuelo, Fecha de carga
- Especie (Búfala, Bovino, Otro)
- Estado
- Total modelo, Total revisado, Diferencia (fórmula)
- Versión detector, Parámetros (JSON corto)
- Revisor (FK simbólica `SIRIUS-PER-XXXX`), Fecha de revisión
- URL imagen original, URL JSON modelo, URL JSON revisado
- Metadatos de vuelo: altura, ángulo de cámara, observaciones

No crear registros que ya creen automatizaciones de Airtable. Antes de escribir en una base existente, revisar sus automatizaciones.

## 7. Convenciones

- TypeScript `strict`, sin `any`. Todo el código es TypeScript; no se agrega Python.
- Toda entrada externa (formularios, respuestas de los modelos de IA, Airtable) se valida en el borde con Zod.
- Secretos solo en variables de entorno; `.env.example` siempre actualizado. Nunca commitear llaves.
- Commits pequeños con Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Una rama por tarea, PR con descripción de qué cambia y cómo se probó.
- Tests: unitarios en domain y application (obligatorios); de integración con mocks para Airtable, storage y las APIs de IA. La calidad de los métodos de detección contra la foto de referencia (120 búfalas) se mide aparte, con tolerancia definida: cuesta por corrida y no va en CI.
- Decisiones de arquitectura relevantes se documentan como ADR en `/docs/adr/NNNN-titulo.md`.
- UI en español. Código, nombres de variables y commits en inglés.

## 8. Decisiones abiertas (no asumir; preguntar)

- ~~**D1 — Almacenamiento de imágenes.**~~ Cerrada en el ADR 0006: bucket S3 privado detrás del puerto `ObjectStorage`, con subida directa desde el navegador mediante URL firmada.
- **D2 — Base de Airtable.** ¿Base nueva de ganadería o tabla dentro de una base existente?
- **D3 — Fuente de los potreros.** ¿Se leen de GeoMaps (con su polígono) o de un catálogo propio?
- **D4 — Autenticación.** ¿Mismo esquema de auth que el resto de Sirius Verse?

## 9. Qué NO hacer

- No meter lógica de detección en el frontend ni en route handlers de Next: vive en `infrastructure/detector`, detrás del puerto `Detector`, y la ruta solo llama al caso de uso.
- No guardar cada animal como fila de Airtable.
- No "arreglar" el conteo automático en silencio: si el detector falla, el conteo queda en `error` con el mensaje.
- No reducir la resolución de la imagen antes de detectar (los animales miden 10–20 px).
- No introducir dependencias nuevas grandes sin justificarlas en el PR.
