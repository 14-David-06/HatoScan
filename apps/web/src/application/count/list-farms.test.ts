import { describe, expect, it } from 'vitest';
import { Count, toCountId } from '@/domain/index';
import { InMemoryCounts, newCount } from '../../../test/fakes';
import { ListFarms } from './list-farms';

function countAt(n: number, farm: string, uploadedAt: string): Count {
  return Count.restore({
    ...newCount().toProps(),
    id: toCountId(`SIRIUS-CONTEO-${String(n).padStart(4, '0')}`),
    farm,
    uploadedAt: new Date(uploadedAt),
  });
}

describe('ListFarms', () => {
  it('lists each farm once, most recent first, with its latest spelling', async () => {
    const counts = new InMemoryCounts(
      countAt(1, 'guaicaramo', '2026-10-01T12:00:00Z'),
      countAt(2, 'La Ceiba', '2026-10-02T12:00:00Z'),
      countAt(3, ' Guaicáramo ', '2026-10-03T12:00:00Z'),
      countAt(4, '', '2026-10-04T12:00:00Z'),
    );
    expect(await new ListFarms(counts).execute()).toEqual(['Guaicáramo', 'La Ceiba']);
  });
});
