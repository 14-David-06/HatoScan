import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import {
  COUNT_STATUSES,
  Count,
  SPECIES,
  toCountId,
  toDetectorVersion,
  toPersonId,
  type CountId,
  type CountIdGenerator,
  type CountProps,
  type CountRepository,
} from '@/domain/index';

const ImageSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const StoredCountSchema = z.object({
  id: z.string(),
  pastureId: z.string(),
  species: z.enum(SPECIES),
  flightDate: z.string().datetime(),
  uploadedAt: z.string().datetime(),
  flight: z.object({
    altitudeM: z.number().positive().optional(),
    cameraAngleDeg: z.number().min(0).max(90).optional(),
    notes: z.string().optional(),
  }),
  originalImageKey: z.string().min(1),
  status: z.enum(COUNT_STATUSES),
  model: z
    .object({
      detectorVersion: z.string(),
      paramsHash: z.string(),
      params: z.record(z.unknown()),
      image: ImageSchema,
      total: z.number().int().nonnegative(),
      resultKey: z.string(),
    })
    .optional(),
  review: z
    .object({
      reviewerId: z.string(),
      reviewedAt: z.string().datetime(),
      total: z.number().int().nonnegative(),
      resultKey: z.string(),
    })
    .optional(),
  errorMessage: z.string().optional(),
});

const StoreSchema = z.object({
  lastNumber: z.number().int().nonnegative(),
  counts: z.array(StoredCountSchema),
});

type StoredCount = z.infer<typeof StoredCountSchema>;
type Store = z.infer<typeof StoreSchema>;

/**
 * Registro de conteos en un archivo JSON, solo para desarrollo local mientras se decide D2
 * (base de Airtable). Misma forma de fila que tendrá Airtable: una por conteo, sin binarios.
 */
export class JsonFileCountRepository implements CountRepository, CountIdGenerator {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async findById(id: CountId): Promise<Count | undefined> {
    const store = await this.read();
    const stored = store.counts.find((c) => c.id === id);
    return stored ? fromStored(stored) : undefined;
  }

  async list(): Promise<readonly Count[]> {
    const store = await this.read();
    return store.counts
      .map(fromStored)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  save(count: Count): Promise<void> {
    return this.mutate((store) => {
      const stored = toStored(count);
      const index = store.counts.findIndex((c) => c.id === stored.id);
      if (index === -1) store.counts.push(stored);
      else store.counts[index] = stored;
      return undefined;
    });
  }

  next(): Promise<CountId> {
    return this.mutate((store) => {
      store.lastNumber += 1;
      return toCountId(`SIRIUS-CONTEO-${String(store.lastNumber).padStart(4, '0')}`);
    });
  }

  /** Serializa las escrituras dentro del proceso; la escritura es atómica (tmp + rename). */
  private mutate<T>(change: (store: Store) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const store = await this.read();
      const result = change(store);
      await mkdir(dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(store, null, 2));
      await rename(temporary, this.filePath);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async read(): Promise<Store> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (isNotFound(error)) return { lastNumber: 0, counts: [] };
      throw error;
    }
    return StoreSchema.parse(JSON.parse(raw));
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function toStored(count: Count): StoredCount {
  const p = count.toProps();
  return {
    id: p.id,
    pastureId: p.pastureId,
    species: p.species,
    flightDate: p.flightDate.toISOString(),
    uploadedAt: p.uploadedAt.toISOString(),
    flight: { ...p.flight },
    originalImageKey: p.originalImageKey,
    status: p.status,
    ...(p.model && {
      model: {
        detectorVersion: p.model.detector.version,
        paramsHash: p.model.detector.paramsHash,
        params: { ...p.model.params },
        image: p.model.image,
        total: p.model.total,
        resultKey: p.model.resultKey,
      },
    }),
    ...(p.review && {
      review: {
        reviewerId: p.review.reviewerId,
        reviewedAt: p.review.reviewedAt.toISOString(),
        total: p.review.total,
        resultKey: p.review.resultKey,
      },
    }),
    ...(p.errorMessage !== undefined && { errorMessage: p.errorMessage }),
  };
}

function fromStored(s: StoredCount): Count {
  const { altitudeM, cameraAngleDeg, notes } = s.flight;
  const props: CountProps = {
    id: toCountId(s.id),
    pastureId: s.pastureId,
    species: s.species,
    flightDate: new Date(s.flightDate),
    uploadedAt: new Date(s.uploadedAt),
    flight: {
      ...(altitudeM !== undefined && { altitudeM }),
      ...(cameraAngleDeg !== undefined && { cameraAngleDeg }),
      ...(notes !== undefined && { notes }),
    },
    originalImageKey: s.originalImageKey,
    status: s.status,
    ...(s.model && {
      model: {
        detector: toDetectorVersion(s.model.detectorVersion, s.model.paramsHash),
        params: s.model.params,
        image: s.model.image,
        total: s.model.total,
        resultKey: s.model.resultKey,
      },
    }),
    ...(s.review && {
      review: {
        reviewerId: toPersonId(s.review.reviewerId),
        reviewedAt: new Date(s.review.reviewedAt),
        total: s.review.total,
        resultKey: s.review.resultKey,
      },
    }),
    ...(s.errorMessage !== undefined && { errorMessage: s.errorMessage }),
  };
  return Count.restore(props);
}
