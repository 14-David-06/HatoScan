// AUTO-GENERADO desde schemas/image-info.schema.json. No editar.
import { z } from 'zod';

export const ImageInfoSchema = z
  .object({ width: z.number().int().gte(1), height: z.number().int().gte(1) })
  .strict()
  .describe('Dimensiones de la imagen original, en píxeles.');
export type ImageInfo = z.infer<typeof ImageInfoSchema>;
