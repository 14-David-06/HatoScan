import type { Count, CountRepository } from '@/domain/index';

/** Conteos más recientes primero. */
export class ListCounts {
  constructor(private readonly counts: CountRepository) {}

  execute(): Promise<readonly Count[]> {
    return this.counts.list();
  }
}
