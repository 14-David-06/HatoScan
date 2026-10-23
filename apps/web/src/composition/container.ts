import 'server-only';
import { resolve } from 'node:path';
import { AuthenticateUser } from '@/application/auth/authenticate-user';
import { GetCountDetail } from '@/application/count/get-count-detail';
import { ListDetectionMethods } from '@/application/count/list-detection-methods';
import { ListCounts } from '@/application/count/list-counts';
import { ListFarms } from '@/application/count/list-farms';
import { ProcessCount } from '@/application/count/process-count';
import { RegisterCount } from '@/application/count/register-count';
import { ReviewCount } from '@/application/count/review-count';
import type { Clock, User } from '@/domain/index';
import { AirtableCountRepository } from '@/infrastructure/airtable/airtable-count-repository';
import { AirtableUserDirectory } from '@/infrastructure/airtable/airtable-user-directory';
import { LoginRateLimiter } from '@/infrastructure/auth/login-rate-limiter';
import { ScryptPasswordHasher } from '@/infrastructure/auth/scrypt-password-hasher';
import { signSession, verifySession } from '@/infrastructure/auth/session-token';
import { getEnv } from '@/infrastructure/config/env';
import { JsonFileCountRepository } from '@/infrastructure/counts/json-file-count-repository';
import { HttpDetector } from '@/infrastructure/detector/http-detector';
import { ObjectStorageResultStore } from '@/infrastructure/results/object-storage-result-store';
import { LocalFsObjectStorage } from '@/infrastructure/storage/local-fs-object-storage';

/**
 * Raíz de composición: único lugar donde se eligen los adaptadores concretos.
 * Conteos y usuarios en Airtable (D2); imágenes y JSON aún en el almacenamiento local (ADR 0004)
 * hasta cerrar D1. Cambiar un adaptador no toca domain, application ni presentation.
 */
function createContainer() {
  const env = getEnv();
  const dataDir = resolve(env.LOCAL_DATA_DIR);

  const clock: Clock = { now: () => new Date() };
  const storage = new LocalFsObjectStorage({
    rootDir: resolve(dataDir, 'objects'),
    publicBaseUrl: env.APP_BASE_URL,
    signingSecret: env.LOCAL_STORAGE_SIGNING_SECRET,
  });
  // Registro de conteos: Airtable (D2) si la tabla está configurada; si no, archivo JSON local.
  const counts = env.AIRTABLE_CONTEOS_TABLE_ID
    ? new AirtableCountRepository({
        apiToken: env.AIRTABLE_API_TOKEN,
        baseId: env.AIRTABLE_BASE_ID,
        tableId: env.AIRTABLE_CONTEOS_TABLE_ID,
      })
    : new JsonFileCountRepository(resolve(dataDir, 'counts.json'));
  const results = new ObjectStorageResultStore(storage);
  const detector = new HttpDetector({
    baseUrl: env.DETECTOR_BASE_URL,
    timeoutMs: env.DETECTOR_TIMEOUT_MS,
    getAuthToken: () => Promise.resolve(env.DETECTOR_API_TOKEN),
  });
  const imageUrlTtlSeconds = env.IMAGE_URL_TTL_SECONDS;
  const users = new AirtableUserDirectory({
    apiToken: env.AIRTABLE_API_TOKEN,
    baseId: env.AIRTABLE_BASE_ID,
    tableId: env.AIRTABLE_USUARIOS_TABLE_ID,
  });

  return {
    localFiles: storage,
    registerCount: new RegisterCount({ counts, ids: counts, storage, clock }),
    listCounts: new ListCounts(counts),
    listFarms: new ListFarms(counts),
    listDetectionMethods: new ListDetectionMethods(detector),
    getCountDetail: new GetCountDetail({ counts, results, storage, imageUrlTtlSeconds }),
    processCount: new ProcessCount({ counts, detector, storage, results, imageUrlTtlSeconds }),
    reviewCount: new ReviewCount({ counts, results, clock }),
    authenticateUser: new AuthenticateUser({ users, passwords: new ScryptPasswordHasher() }),
    loginAttempts: new LoginRateLimiter(),
    sessions: {
      sign: (user: User) => signSession(user, env.AUTH_SESSION_SECRET),
      verify: (token: string | undefined) => verifySession(token, env.AUTH_SESSION_SECRET),
    },
  };
}

export type Container = ReturnType<typeof createContainer>;

// Una instancia por módulo. No se guarda en `globalThis`: tras el recargado en caliente de
// `next dev` mezclaría clases de dos versiones del código y `instanceof` dejaría de funcionar.
let container: Container | undefined;

export function getContainer(): Container {
  container ??= createContainer();
  return container;
}
