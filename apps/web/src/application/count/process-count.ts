import {
  assertValidDetections,
  countActive,
  InvalidDetectionError,
  type Count,
  type CountId,
  type CountRepository,
  type DetectionResultStore,
  type Detector,
  type ObjectStorage,
} from '@/domain/index';
import { CountNotFoundError } from '../errors';

export interface ProcessCountDeps {
  readonly counts: CountRepository;
  readonly detector: Detector;
  readonly storage: ObjectStorage;
  readonly results: DetectionResultStore;
  /** Vigencia de la URL de lectura que recibe el detector. */
  readonly imageUrlTtlSeconds: number;
}

export interface ProcessCountInput {
  readonly countId: CountId;
  readonly detector?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/**
 * Ejecuta el detector sobre un conteo recién subido y deja la propuesta lista para revisión.
 * Si algo falla, el conteo queda en `error` con el mensaje: nunca se corrige en silencio.
 */
export class ProcessCount {
  constructor(private readonly deps: ProcessCountDeps) {}

  async execute(input: ProcessCountInput): Promise<Count> {
    const { counts, detector, storage, results, imageUrlTtlSeconds } = this.deps;

    const count = await counts.findById(input.countId);
    if (!count) throw new CountNotFoundError(input.countId);

    const processing = count.startProcessing();
    await counts.save(processing);

    try {
      const imageUrl = await storage.getReadUrl(processing.originalImageKey, imageUrlTtlSeconds);
      const output = await detector.detect({
        countId: processing.id,
        imageUrl,
        ...(input.detector !== undefined && { detector: input.detector }),
        ...(input.params !== undefined && { params: input.params }),
      });

      assertValidDetections(output.detections, output.image);
      const foreign = output.detections.find((d) => d.origen !== 'modelo');
      if (foreign) {
        throw new InvalidDetectionError(`Detector returned non-model detection "${foreign.id}"`);
      }

      const resultKey = await results.saveModelResult(processing.id, output);
      const proposed = processing.proposeDetections({
        detector: output.detector,
        params: output.params,
        image: output.image,
        total: countActive(output.detections),
        resultKey,
      });
      await counts.save(proposed);
      return proposed;
    } catch (error) {
      const failed = processing.fail(describeError(error));
      await counts.save(failed);
      return failed;
    }
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return `Unknown error: ${String(error)}`;
}
