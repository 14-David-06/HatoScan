import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import {
  toCountId,
  type Count,
  type CountId,
  type CountIdGenerator,
  type CountRepository,
} from '@/domain/index';
import { StoredCountSchema, fromStored, toStored } from './stored-count';

const StoreSchema = z.object({
  lastNumber: z.number().int().nonnegative(),
  counts: z.array(StoredCountSchema),
});

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
