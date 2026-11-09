import 'server-only';
import { z } from 'zod';

const withoutTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

const emptyAsUndefined = (value: unknown) => (value === '' ? undefined : value);

const TABLE_ID = z.string().regex(/^tbl[A-Za-z0-9]{14}$/);

const optionalSecret = z.preprocess(emptyAsUndefined, z.string().min(1).optional());

/** Lista separada por comas; vacía = sin lista. */
const commaList = z.preprocess(
  emptyAsUndefined,
  z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .optional(),
);

const BaseSchema = z.object({
  /** Llave de Claude (métodos `claude-vision*`). Sin ella, esos métodos salen como no disponibles. */
  ANTHROPIC_API_KEY: optionalSecret,
  /** Llave de OpenAI (métodos `openai-vision*`). Sin ella, esos métodos salen como no disponibles. */
  OPENAI_API_KEY: optionalSecret,
  /** Método usado cuando la persona no elige uno. Debe estar entre los habilitados. */
  DETECTOR_DEFAULT_METHOD: z.preprocess(emptyAsUndefined, z.string().default('claude-vision')),
  /** Métodos que se ofrecen, separados por comas. Vacío = todos. */
  DETECTOR_ENABLED_METHODS: commaList,
  /**
   * Tiempo máximo de una detección. Por debajo del `maxDuration` (800 s) de la ruta de
   * procesamiento, para dejar el conteo en `error` antes de que Vercel corte la función.
   */
  DETECTOR_TIMEOUT_MS: z.coerce.number().int().positive().max(790_000).default(780_000),
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
  cached ??= parseEnv(process.env);
  return cached;
}

/**
 * Lanza un `Error` simple con una línea por variable. Un `ZodError` tiene `message` de solo lectura
 * y Next.js falla al anotarlo ("Cannot set property message"), lo que esconde la causa.
 */
export function parseEnv(raw: Readonly<Record<string, string | undefined>>): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues.map(
    (issue) => `  - ${issue.path.join('.') || '(env)'}: ${issue.message}`,
  );
  throw new Error(
    `Invalid environment variables (see apps/web/.env.example):\n${problems.join('\n')}`,
  );
}
