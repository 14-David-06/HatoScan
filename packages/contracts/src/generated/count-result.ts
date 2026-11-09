// AUTO-GENERADO desde schemas/count-result.schema.json. No editar.
import { z } from 'zod';

export const CountResultSchema = z
  .object({
    conteo_id: z.string().regex(new RegExp('^SIRIUS-CONTEO-[0-9]{4,}$')),
    detector_version: z
      .string()
      .regex(new RegExp('^[a-z0-9][a-z0-9-]*@[0-9]+[.][0-9]+[.][0-9]+$'))
      .describe("Nombre y versión semántica, ej. 'claude-vision@0.3.0'."),
    params: z.record(z.string(), z.unknown()),
    params_hash: z
      .string()
      .regex(new RegExp('^[a-f0-9]{64}$'))
      .describe('SHA-256 (hex) del JSON canónico de params.'),
    image: z
      .object({ width: z.number().int().gte(1), height: z.number().int().gte(1) })
      .strict()
      .describe('Dimensiones de la imagen original, en píxeles.'),
    detections: z.array(
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
    ),
    total: z.number().int().gte(0).describe('Número de detecciones activas.'),
    processing_ms: z.number().int().gte(0).optional(),
  })
  .strict()
  .describe(
    'Salida del detector para un conteo. Es la propuesta del modelo; nunca es el dato oficial.',
  );
export type CountResult = z.infer<typeof CountResultSchema>;
