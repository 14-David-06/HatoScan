import {
  assertReviewConsistent,
  assertTransition,
  assertValidDetections,
  countActive,
  DomainError,
  type Clock,
  type Count,
  type CountId,
  type CountRepository,
  type Detection,
  type DetectionResultStore,
  type PersonId,
} from '@/domain/index';
import { CountNotFoundError } from '../errors';

export interface ReviewCountDeps {
  readonly counts: CountRepository;
  readonly results: DetectionResultStore;
  readonly clock: Clock;
}

export interface ReviewCountInput {
  readonly countId: CountId;
  readonly reviewerId: PersonId;
  /** Conjunto completo revisado: detecciones del modelo (activas o descartadas) + las añadidas. */
  readonly detections: readonly Detection[];
}

/** Registra la revisión humana. El total revisado pasa a ser el dato oficial del conteo. */
export class ReviewCount {
  constructor(private readonly deps: ReviewCountDeps) {}

  async execute(input: ReviewCountInput): Promise<Count> {
    const { counts, results, clock } = this.deps;

    const count = await counts.findById(input.countId);
    if (!count) throw new CountNotFoundError(input.countId);

    // Validar antes de escribir nada en el almacenamiento.
    assertTransition(count.status, 'revisado');
    const model = count.model;
    if (!model) throw new DomainError(`Count ${count.id} has no model proposal`);

    assertValidDetections(input.detections, model.image);
    const modelResult = await results.loadModelResult(model.resultKey);
    assertReviewConsistent(modelResult.detections, input.detections);

    const reviewedAt = clock.now();
    const resultKey = await results.saveReview({
      countId: count.id,
      reviewerId: input.reviewerId,
      reviewedAt,
      sourceDetectorVersion: model.detector.version,
      image: model.image,
      detections: input.detections,
    });

    const reviewed = count.completeReview({
      reviewerId: input.reviewerId,
      reviewedAt,
      total: countActive(input.detections),
      resultKey,
    });
    await counts.save(reviewed);
    return reviewed;
  }
}
