// AUTO-GENERADO desde schemas/review-result.schema.json. No editar.
import { z } from 'zod';

export const ReviewResultSchema = z
  .object({
    conteo_id: z.string().regex(new RegExp('^SIRIUS-CONTEO-[0-9]{4,}$')),
    reviewer_id: z.string().regex(new RegExp('^SIRIUS-PER-[0-9]{4,}$')),
    reviewed_at: z.string().datetime({ offset: true }),
    source_detector_version: z.string(),
    image: z
      .object({ width: z.number().int().gte(1), height: z.number().int().gte(1) })
      .strict()
      .describe('Dimensiones de la imagen original, en píxeles.'),
    detections: z
      .array(
        z
          .object({
            id: z.string().min(1),
            x: z.number().gte(0),
            y: z.number().gte(0),
            tipo: z.enum(['punto', 'caja']),
            w: z.number().gt(0).optional(),
            h: z.number().gt(0).optional(),
            score: z.number().gte(0).lte(1).optional(),
            origen: z.enum(['modelo', 'humano']),
            estado: z.enum(['activa', 'descartada']),
          })
          .strict()
          .describe(
            "Un animal detectado o marcado. Coordenadas en píxeles de la imagen original, origen arriba-izquierda. Para tipo 'caja', (x, y) es la esquina superior izquierda.",
          ),
      )
      .describe('Incluye las descartadas (negativos para entrenamiento).'),
    total: z.number().int().gte(0).describe('Número de detecciones activas.'),
  })
  .strict()
  .describe(
    'Detecciones confirmadas por un revisor humano. Es el dato oficial y la fuente del dataset de entrenamiento.',
  );
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
