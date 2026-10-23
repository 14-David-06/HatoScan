import type { CountRepository } from '@/domain/index';

/**
 * Fincas ya usadas en conteos, la más reciente primero, para sugerirlas al registrar uno nuevo y
 * que el mismo nombre se repita igual. Sin distinguir mayúsculas, tildes ni espacios de más: se
 * conserva la escritura del conteo más reciente.
 */
export class ListFarms {
  constructor(private readonly counts: CountRepository) {}

  async execute(): Promise<readonly string[]> {
    const farms = new Map<string, string>();
    for (const count of await this.counts.list()) {
      const farm = count.farm.trim().replace(/\s+/g, ' ');
      const key = farmKey(farm);
      if (key !== '' && !farms.has(key)) farms.set(key, farm);
    }
    return [...farms.values()];
  }
}

function farmKey(farm: string): string {
  return farm.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
