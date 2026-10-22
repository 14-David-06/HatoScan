import { describe, expect, it } from 'vitest';
import type { CountSummaryView } from '../view-models';
import {
  describeNoResults,
  filterCounts,
  latestReviewed,
  matchesSearch,
  normalizeSearch,
  parseStatusFilter,
  tallyByGroup,
} from './filters';

const count = (overrides: Partial<CountSummaryView> & Pick<CountSummaryView, 'id'>) =>
  ({
    pastureId: 'Potrero 12',
    species: 'bufala',
    flightDate: '2026-09-23',
    uploadedAt: '2026-09-24T10:00:00.000Z',
    status: 'pendiente_revision',
    ...overrides,
  }) satisfies CountSummaryView;

const counts: readonly CountSummaryView[] = [
  count({ id: 'SIRIUS-CONTEO-0005', status: 'procesando', pastureId: 'Potrero 4 · La Ceiba' }),
  count({ id: 'SIRIUS-CONTEO-0004', status: 'subido' }),
  count({ id: 'SIRIUS-CONTEO-0003', status: 'error', pastureId: 'Potrero 7' }),
  count({
    id: 'SIRIUS-CONTEO-0002',
    status: 'revisado',
    reviewedTotal: 118,
    flightDate: '2026-08-02',
  }),
  count({ id: 'SIRIUS-CONTEO-0001', status: 'revisado', reviewedTotal: 120 }),
  count({ id: 'SIRIUS-CONTEO-0000', modelTotal: 9 }),
];

describe('parseStatusFilter', () => {
  it('accepts the known groups and falls back to all', () => {
    expect(parseStatusFilter('pendientes')).toBe('pendientes');
    expect(parseStatusFilter('en-proceso')).toBe('en-proceso');
    expect(parseStatusFilter('pendiente_revision')).toBe('todos');
    expect(parseStatusFilter(null)).toBe('todos');
  });
});

describe('tallyByGroup', () => {
  it('counts uploaded and processing counts together', () => {
    expect(tallyByGroup(counts)).toEqual({
      pendientes: 1,
      revisados: 2,
      'en-proceso': 2,
      error: 1,
    });
  });
});

describe('normalizeSearch', () => {
  it('strips accents and tildes, lowercases and collapses spaces', () => {
    expect(normalizeSearch('  Potrero   Ñandú  Ceíba ')).toBe('potrero nandu ceiba');
    // Ya descompuesto (NFD): la marca combinante también se quita.
    expect(normalizeSearch('Cei\u0301ba')).toBe('ceiba');
  });
});

describe('matchesSearch', () => {
  it('ignores case, accents and extra spaces, on pasture or id', () => {
    const ceiba = counts[0]!;
    expect(matchesSearch(ceiba, '  la   CEIBA ')).toBe(true);
    expect(matchesSearch(ceiba, 'ceíba')).toBe(true);
    expect(matchesSearch(ceiba, '0005')).toBe(true);
    expect(matchesSearch(ceiba, 'potrero 12')).toBe(false);
    expect(matchesSearch(ceiba, '')).toBe(true);
  });
});

describe('filterCounts', () => {
  it('combines group and search and keeps the received order', () => {
    expect(filterCounts(counts, 'en-proceso', '').map((c) => c.id)).toEqual([
      'SIRIUS-CONTEO-0005',
      'SIRIUS-CONTEO-0004',
    ]);
    expect(filterCounts(counts, 'revisados', 'potrero 12').map((c) => c.id)).toEqual([
      'SIRIUS-CONTEO-0002',
      'SIRIUS-CONTEO-0001',
    ]);
    expect(filterCounts(counts, 'error', 'ceiba')).toEqual([]);
  });
});

describe('latestReviewed', () => {
  it('picks the reviewed count with the most recent flight', () => {
    expect(latestReviewed(counts)?.id).toBe('SIRIUS-CONTEO-0001');
    expect(latestReviewed(counts.filter((c) => c.status !== 'revisado'))).toBeUndefined();
  });
});

describe('describeNoResults', () => {
  it('names the filter and the search text', () => {
    expect(describeNoResults('error', '')).toBe('No hay conteos con error.');
    expect(describeNoResults('todos', ' ceiba ')).toBe('Ningún potrero ni ID contiene «ceiba».');
    expect(describeNoResults('pendientes', 'x')).toBe(
      'No hay conteos por revisar cuyo potrero o ID contenga «x».',
    );
  });
});
