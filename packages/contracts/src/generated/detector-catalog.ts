// AUTO-GENERADO desde schemas/detector-catalog.schema.json. No editar.
import { z } from 'zod';

export const DetectorCatalogSchema = z
  .object({
    default_detector: z
      .string()
      .min(1)
      .describe('Nombre del detector que se usa si la petición no indica uno.'),
    detectors: z.array(
      z
        .object({
          name: z.string().regex(new RegExp('^[a-z0-9][a-z0-9-]*$')),
          version: z.string().regex(new RegExp('^[0-9]+[.][0-9]+[.][0-9]+$')),
          label: z.string().min(1).describe('Nombre corto para la UI.'),
          description: z.string().describe('Para qué sirve y cuándo elegirlo. Texto para la UI.'),
          available: z
            .boolean()
            .describe('false si el método está declarado pero todavía no se puede ejecutar.'),
        })
        .strict(),
    ),
  })
  .strict()
  .describe(
    'Métodos de detección que ofrece el servicio. La web los muestra para que la persona elija.',
  );
export type DetectorCatalog = z.infer<typeof DetectorCatalogSchema>;
