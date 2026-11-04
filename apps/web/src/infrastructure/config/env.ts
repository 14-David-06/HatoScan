import 'server-only';
import { z } from 'zod';

const withoutTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

const emptyAsUndefined = (value: unknown) => (value === '' ? undefined : value);

const TABLE_ID = z.string().regex(/^tbl[A-Za-z0-9]{14}$/);

const BaseSchema = z.object({
  DETECTOR_BASE_URL: z.string().url().transform(withoutTrailingSlash),
  DETECTOR_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  /** Token compartido con el detector; va en `Authorization: Bearer` en cada llamada. */
  DETECTOR_API_TOKEN: z.string().min(16),
  /** URL pública de la app. */
  APP_BASE_URL: z.string().url().transform(withoutTrailingSlash),
  /** Vigencia de las URLs de lectura de imágenes, en segundos. */
  IMAGE_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  /** Vigencia de las URLs de subida de la foto original, en segundos. */
  UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  /** Secreto HMAC de la cookie de sesión. */
  AUTH_SESSION_SECRET: z.string().min(32),
  /** Airtable (D2 resuelta: base de HatoScan). */
  AIRTABLE_API_TOKEN: z.string().min(1),
  AIRTABLE_BASE_ID: z.string().regex(/^app[A-Za-z0-9]{14}$/),
  AIRTABLE_USUARIOS_TABLE_ID: TABLE_ID,
});

/** Desarrollo: imágenes y JSON en disco; conteos en Airtable o, sin tabla, en un archivo JSON. */
const LocalSchema = BaseSchema.extend({
  STORAGE_DRIVER: z.literal('local'),
  /** Carpeta de los adaptadores locales (imágenes, JSON y registro de conteos). */
  LOCAL_DATA_DIR: z.string().min(1).default('.data'),
  /** Secreto HMAC de las URLs firmadas del almacenamiento local. */
  LOCAL_STORAGE_SIGNING_SECRET: z.string().min(32),
  /** Tabla Conteos. Vacía: los conteos se guardan en el archivo JSON local. */
  AIRTABLE_CONTEOS_TABLE_ID: z.preprocess(emptyAsUndefined, TABLE_ID.optional()),
});

/**
 * Producción (Vercel, ADR 0006): bucket S3 privado. Sin disco persistente, la tabla Conteos es
 * obligatoria. Las llaves no usan los nombres `AWS_*`, que Vercel reserva.
 */
const S3Schema = BaseSchema.extend({
  STORAGE_DRIVER: z.literal('s3'),
  S3_BUCKET: z.string().min(3),
  S3_REGION: z.string().regex(/^[a-z]{2}(-[a-z]+)+-\d$/),
  S3_ACCESS_KEY_ID: z.string().min(16),
  S3_SECRET_ACCESS_KEY: z.string().min(16),
  AIRTABLE_CONTEOS_TABLE_ID: TABLE_ID,
});

const EnvSchema = z.preprocess(
  (raw) => {
    const env = raw as Record<string, unknown>;
    return { ...env, STORAGE_DRIVER: emptyAsUndefined(env.STORAGE_DRIVER) ?? 'local' };
  },
  z.discriminatedUnion('STORAGE_DRIVER', [LocalSchema, S3Schema]),
);

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Variables de entorno del servidor, validadas una sola vez. Falla rápido si falta algo. */
export function getEnv(): Env {
  cached ??= EnvSchema.parse(process.env);
  return cached;
}
