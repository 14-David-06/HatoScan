import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  DETECTOR_BASE_URL: z
    .string()
    .url()
    .transform((url) => url.replace(/\/+$/, '')),
  DETECTOR_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Variables de entorno del servidor, validadas una sola vez. Falla rápido si falta algo. */
export function getEnv(): Env {
  cached ??= EnvSchema.parse(process.env);
  return cached;
}
