import { describe, expect, it } from 'vitest';
import { toCountId } from '@/domain/index';
import { fromStored, type StoredCount } from '../counts/stored-count';
import { AirtableCountRepository, fromFields, toFields } from './airtable-count-repository';

const REVIEWED: StoredCount = {
  id: 'SIRIUS-CONTEO-0007',
  farm: 'Guaicaramo',
  pastureId: 'Potrero 12',
  species: 'bufala',
  flightDate: '2026-09-23T12:00:00.000Z',
  uploadedAt: '2026-10-21T15:00:00.000Z',
  flight: { altitudeM: 80, cameraAngleDeg: 90, notes: 'Viento fuerte' },
  originalImageKey: 'counts/SIRIUS-CONTEO-0007/original.png',
  status: 'revisado',
  model: {
    detectorVersion: 'claude-vision@0.2.0',
    paramsHash: 'a'.repeat(64),
    params: { effort: 'low', tile_px: 1024 },
    image: { width: 1920, height: 1080 },
    total: 118,
    resultKey: 'counts/SIRIUS-CONTEO-0007/model-results/x.json',
  },
  review: {
    reviewerId: 'SIRIUS-PER-0001',
    reviewedAt: '2026-10-22T14:00:00.000Z',
    total: 120,
    resultKey: 'counts/SIRIUS-CONTEO-0007/review-result.json',
  },
};

function fakeAirtable(pages: Record<string, unknown>[][]) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  let page = 0;
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
    calls.push({ method: init?.method ?? 'GET', url, body });
    if (init?.method === 'PATCH') return Response.json({ records: [] });
    const records = (pages[page] ?? []).map((fields) => ({ fields }));
    page += 1;
    return Response.json({ records, ...(page < pages.length && { offset: `p${page}` }) });
  }) as typeof fetch;
  const repo = new AirtableCountRepository({
    apiToken: 't',
    baseId: 'appX',
    tableId: 'tblY',
    fetch: fetchFn,
  });
  return { repo, calls };
}

describe('Airtable count row mapping', () => {
  it('round-trips a reviewed count', () => {
    expect(fromFields(toFields(REVIEWED) as Record<string, unknown>)).toEqual(REVIEWED);
  });

  it('clears columns that no longer apply and reads a new count back', () => {
    const uploaded: StoredCount = {
      ...REVIEWED,
      status: 'subido',
      flight: {},
      model: undefined,
      review: undefined,
    };
    const fields = toFields(uploaded);
    expect(fields['Versión detector']).toBeNull();
    expect(fields['Revisor']).toBeNull();
    expect(fields['Fecha de vuelo']).toBe('2026-09-23');
    // Airtable no devuelve las celdas vacías.
    const returned = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null));
    const count = fromStored(fromFields(returned));
    expect(count.status).toBe('subido');
    expect(count.toProps().model).toBeUndefined();
  });

  it('reads a count saved before the farm column existed', () => {
    const legacy = toFields(REVIEWED) as Record<string, unknown>;
    delete legacy['Finca'];
    expect(fromStored(fromFields(legacy)).farm).toBe('');
  });
});

describe('AirtableCountRepository', () => {
  it('upserts by ID Conteo', async () => {
    const { repo, calls } = fakeAirtable([]);
    await repo.save(fromStored(REVIEWED));
    expect(calls[0]).toMatchObject({
      method: 'PATCH',
      body: { performUpsert: { fieldsToMergeOn: ['ID Conteo'] } },
    });
  });

  it('issues the next number across pages and never repeats it in-process', async () => {
    const { repo } = fakeAirtable([
      [{ 'ID Conteo': 'SIRIUS-CONTEO-0002' }],
      [{ 'ID Conteo': 'SIRIUS-CONTEO-0009' }, {}],
    ]);
    expect(await repo.next()).toBe('SIRIUS-CONTEO-0010');
    expect(await repo.next()).toBe('SIRIUS-CONTEO-0011');
  });

  it('finds a count by id', async () => {
    const { repo, calls } = fakeAirtable([[toFields(REVIEWED) as Record<string, unknown>]]);
    const count = await repo.findById(toCountId('SIRIUS-CONTEO-0007'));
    expect(count?.officialTotal).toBe(120);
    expect(new URL(calls[0]?.url ?? '').searchParams.get('filterByFormula')).toBe(
      "{ID Conteo} = 'SIRIUS-CONTEO-0007'",
    );
  });
});
