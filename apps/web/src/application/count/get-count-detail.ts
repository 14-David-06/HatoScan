import type {
  Count,
  CountId,
  CountRepository,
  DetectionOutput,
  DetectionResultStore,
  ObjectStorage,
  ReviewRecord,
} from '@/domain/index';
import { CountNotFoundError } from '../errors';

export interface GetCountDetailDeps {
  readonly counts: CountRepository;
  readonly results: DetectionResultStore;
  readonly storage: ObjectStorage;
  /** Vigencia de la URL de lectura de la imagen que recibe el navegador. */
  readonly imageUrlTtlSeconds: number;
}

export interface CountDetail {
  readonly count: Count;
  /** URL de lectura temporal de la imagen original, a resolución completa. */
  readonly imageUrl: string;
  readonly model?: DetectionOutput;
  readonly review?: ReviewRecord;
}

/** Todo lo que la pantalla de revisión necesita de un conteo. */
export class GetCountDetail {
  constructor(private readonly deps: GetCountDetailDeps) {}

  async execute(countId: CountId): Promise<CountDetail> {
    const { counts, results, storage, imageUrlTtlSeconds } = this.deps;

    const count = await counts.findById(countId);
    if (!count) throw new CountNotFoundError(countId);

    const [imageUrl, model, review] = await Promise.all([
      storage.getReadUrl(count.originalImageKey, imageUrlTtlSeconds),
      count.model ? results.loadModelResult(count.model.resultKey) : undefined,
      count.review ? results.loadReview(count.review.resultKey) : undefined,
    ]);

    return {
      count,
      imageUrl,
      ...(model !== undefined && { model }),
      ...(review !== undefined && { review }),
    };
  }
}
