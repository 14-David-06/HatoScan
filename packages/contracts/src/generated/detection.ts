// AUTO-GENERADO desde schemas/detection.schema.json. No editar.
import { z } from 'zod';

export const DetectionSchema = z
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
  );
export type Detection = z.infer<typeof DetectionSchema>;
