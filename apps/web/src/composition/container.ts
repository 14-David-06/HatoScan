import 'server-only';
import { resolve } from 'node:path';
import { AuthenticateUser } from '@/application/auth/authenticate-user';
import { CreateImageUpload } from '@/application/count/create-image-upload';
import { GetCountDetail } from '@/application/count/get-count-detail';
import { ListDetectionMethods } from '@/application/count/list-detection-methods';
import { ListCounts } from '@/application/count/list-counts';
import { ListFarms } from '@/application/count/list-farms';
import { ProcessCount } from '@/application/count/process-count';
import { RegisterCount } from '@/application/count/register-count';
import { ReviewCount } from '@/application/count/review-count';
import type { Clock, CountIdGenerator, CountRepository, ObjectStorage, User } from '@/domain/index';
import { AirtableCountRepository } from '@/infrastructure/airtable/airtable-count-repository';
import { AirtableUserDirectory } from '@/infrastructure/airtable/airtable-user-directory';
import { LoginRateLimiter } from '@/infrastructure/auth/login-rate-limiter';
import { ScryptPasswordHasher } from '@/infrastructure/auth/scrypt-password-hasher';
import { signSession, verifySession } from '@/infrastructure/auth/session-token';
import { getEnv, type Env } from '@/infrastructure/config/env';
import { JsonFileCountRepository } from '@/infrastructure/counts/json-file-count-repository';
import { createDetectionMethods, enabledMethods } from '@/infrastructure/detector/catalog';
import { InProcessDetector } from '@/infrastructure/detector/in-process-detector';
import { ObjectStorageResultStore } from '@/infrastructure/results/object-storage-result-store';
import { LocalFsObjectStorage } from '@/infrastructure/storage/local-fs-object-storage';
import { S3ObjectStorage } from '@/infrastructure/storage/s3-object-storage';

/**
 * Raíz de composición: único lugar donde se eligen los adaptadores concretos.
 * Conteos y usuarios en Airtable (D2). Imágenes y JSON en un bucket S3 privado en producción (D1,
 * ADR 0006) o en disco en desarrollo (ADR 0004). Cambiar un adaptador no toca domain, application
 * ni presentation.
 */
function createContainer() {
  const env = getEnv();
  const clock: Clock = { now: () => new Date() };
  const { storage, localFiles, counts } = createStores(env);
  const results = new ObjectStorageResultStore(storage);
  // Detección dentro de la app, con modelos de IA por API (ADR 0007).
  const detector = new InProcessDetector({
    methods: enabledMethods(
      createDetectionMethods({
        anthropicApiKey: env.ANTHROPIC_API_KEY,
        openaiApiKey: env.OPENAI_API_KEY,
      }),
      env.DETECTOR_ENABLED_METHODS,
    ),
    defaultMethod: env.DETECTOR_DEFAULT_METHOD,
    timeoutMs: env.DETECTOR_TIMEOUT_MS,
  });
  const imageUrlTtlSeconds = env.IMAGE_URL_TTL_SECONDS;
  const users = new AirtableUserDirectory({
    apiToken: env.AIRTABLE_API_TOKEN,
    baseId: env.AIRTABLE_BASE_ID,
    tableId: env.AIRTABLE_USUARIOS_TABLE_ID,
  });

  return {
    /** Solo en desarrollo: `/api/files` sirve y recibe los archivos del disco. */
    localFiles,
    createImageUpload: new CreateImageUpload({ storage, ttlSeconds: env.UPLOAD_URL_TTL_SECONDS }),
    registerCount: new RegisterCount({ counts, ids: counts, storage, clock }),
    listCounts: new ListCounts(counts),
    listFarms: new ListFarms(counts),
    listDetectionMethods: new ListDetectionMethods(detector),
    getCountDetail: new GetCountDetail({ counts, results, storage, imageUrlTtlSeconds }),
    processCount: new ProcessCount({ counts, detector, storage, results }),
    reviewCount: new ReviewCount({ counts, results, clock }),
    authenticateUser: new AuthenticateUser({ users, passwords: new ScryptPasswordHasher() }),
    loginAttempts: new LoginRateLimiter(),
    sessions: {
      sign: (user: User) => signSession(user, env.AUTH_SESSION_SECRET),
      verify: (token: string | undefined) => verifySession(token, env.AUTH_SESSION_SECRET),
    },
  };
}

function createStores(env: Env): {
  storage: ObjectStorage;
  localFiles: LocalFsObjectStorage | undefined;
  counts: CountRepository & CountIdGenerator;
} {
  const airtableCounts = (tableId: string) =>
    new AirtableCountRepository({
      apiToken: env.AIRTABLE_API_TOKEN,
      baseId: env.AIRTABLE_BASE_ID,
      tableId,
    });

  if (env.STORAGE_DRIVER === 's3') {
    const storage = new S3ObjectStorage({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    });
    return {
      storage,
      localFiles: undefined,
      counts: airtableCounts(env.AIRTABLE_CONTEOS_TABLE_ID),
    };
  }

  const dataDir = resolve(env.LOCAL_DATA_DIR);
  const storage = new LocalFsObjectStorage({
    rootDir: resolve(dataDir, 'objects'),
    publicBaseUrl: env.APP_BASE_URL,
    signingSecret: env.LOCAL_STORAGE_SIGNING_SECRET,
  });
  // Registro de conteos: Airtable si la tabla está configurada; si no, archivo JSON local.
  const counts = env.AIRTABLE_CONTEOS_TABLE_ID
    ? airtableCounts(env.AIRTABLE_CONTEOS_TABLE_ID)
    : new JsonFileCountRepository(resolve(dataDir, 'counts.json'));
  return { storage, localFiles: storage, counts };
}

export type Container = ReturnType<typeof createContainer>;

// Una instancia por módulo. No se guarda en `globalThis`: tras el recargado en caliente de
// `next dev` mezclaría clases de dos versiones del código y `instanceof` dejaría de funcionar.
let container: Container | undefined;

export function getContainer(): Container {
  container ??= createContainer();
  return container;
}
