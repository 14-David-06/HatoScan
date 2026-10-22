import 'server-only';
import { z } from 'zod';

const withoutTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

const EnvSchema = z.object({
  DETECTOR_BASE_URL: z.string().url().transform(withoutTrailingSlash),
  DETECTOR_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  /** Token compartido con el detector; va en `Authorization: Bearer` en cada llamada. */
  DETECTOR_API_TOKEN: z.string().min(16),
  /** URL pública de la app; base de las URLs firmadas que reciben el navegador y el detector. */
  APP_BASE_URL: z.string().url().transform(withoutTrailingSlash),
  /** Vigencia de las URLs de lectura de imágenes, en segundos. */
  IMAGE_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  /** Carpeta de los adaptadores locales (imágenes, JSON y registro de conteos). */
  LOCAL_DATA_DIR: z.string().min(1).default('.data'),
  /** Secreto HMAC de las URLs firmadas del almacenamiento local. */
  LOCAL_STORAGE_SIGNING_SECRET: z.string().min(32),
  /** Secreto HMAC de la cookie de sesión. */
  AUTH_SESSION_SECRET: z.string().min(32),
  /** Airtable (D2 resuelta: base de HatoScan). */
  AIRTABLE_API_TOKEN: z.string().min(1),
  AIRTABLE_BASE_ID: z.string().regex(/^app[A-Za-z0-9]{14}$/),
  AIRTABLE_USUARIOS_TABLE_ID: z.string().regex(/^tbl[A-Za-z0-9]{14}$/),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Variables de entorno del servidor, validadas una sola vez. Falla rápido si falta algo. */
export function getEnv(): Env {
  cached ??= EnvSchema.parse(process.env);
  return cached;
}
