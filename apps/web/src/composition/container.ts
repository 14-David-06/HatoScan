import 'server-only';
import { resolve } from 'node:path';
import { GetCountDetail } from '@/application/count/get-count-detail';
import { ListDetectionMethods } from '@/application/count/list-detection-methods';
import { ListCounts } from '@/application/count/list-counts';
import { ProcessCount } from '@/application/count/process-count';
import { RegisterCount } from '@/application/count/register-count';
import { ReviewCount } from '@/application/count/review-count';
import type { Clock } from '@/domain/index';
import { getEnv } from '@/infrastructure/config/env';
import { JsonFileCountRepository } from '@/infrastructure/counts/json-file-count-repository';
import { HttpDetector } from '@/infrastructure/detector/http-detector';
import { ObjectStorageResultStore } from '@/infrastructure/results/object-storage-result-store';
import { LocalFsObjectStorage } from '@/infrastructure/storage/local-fs-object-storage';

/**
 * Raíz de composición: único lugar donde se eligen los adaptadores concretos.
 * Hoy usa los adaptadores locales (ADR 0004); Airtable (D2) y el storage definitivo (D1)
 * se conectan aquí sin tocar domain, application ni presentation.
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
  const counts = new JsonFileCountRepository(resolve(dataDir, 'counts.json'));
  const results = new ObjectStorageResultStore(storage);
  const detector = new HttpDetector({
    baseUrl: env.DETECTOR_BASE_URL,
    timeoutMs: env.DETECTOR_TIMEOUT_MS,
  });
  const imageUrlTtlSeconds = env.IMAGE_URL_TTL_SECONDS;

  return {
    localFiles: storage,
    registerCount: new RegisterCount({ counts, ids: counts, storage, clock }),
    listCounts: new ListCounts(counts),
    listDetectionMethods: new ListDetectionMethods(detector),
    getCountDetail: new GetCountDetail({ counts, results, storage, imageUrlTtlSeconds }),
    processCount: new ProcessCount({ counts, detector, storage, results, imageUrlTtlSeconds }),
    reviewCount: new ReviewCount({ counts, results, clock }),
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
