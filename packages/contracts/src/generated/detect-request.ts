// AUTO-GENERADO desde schemas/detect-request.schema.json. No editar.
import { z } from 'zod';

export const DetectRequestSchema = z
  .object({
    conteo_id: z.string().regex(new RegExp('^SIRIUS-CONTEO-[0-9]{4,}$')),
    image_url: z.string().url(),
    detector: z
      .string()
      .min(1)
      .describe('Nombre del detector a usar. Si se omite, el servicio usa su detector por defecto.')
      .optional(),
    params: z
      .record(z.string(), z.unknown())
      .describe('Parámetros específicos del detector. Se validan dentro del servicio.')
      .optional(),
  })
  .strict()
  .describe(
    'Petición al servicio de detección. La imagen se entrega por URL firmada (nunca se sube a través de Vercel).',
  );
export type DetectRequest = z.infer<typeof DetectRequestSchema>;
