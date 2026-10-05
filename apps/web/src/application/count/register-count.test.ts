import { describe, expect, it } from 'vitest';
import { InvalidValueError } from '@/domain/index';
import { FakeStorage, fixedClock, InMemoryCounts, SequentialIds } from '../../../test/fakes';
import { RegisterCount, type RegisterCountInput } from './register-count';

const INPUT: RegisterCountInput = {
  pastureId: ' POTRERO-07 ',
  species: 'bufala',
  flightDate: new Date('2026-09-30T07:00:00Z'),
  flight: { altitudeM: 90, cameraAngleDeg: 90 },
  image: { bytes: new Uint8Array([0xff, 0xd8, 0xff]), contentType: 'image/jpeg' },
};

function setup() {
  const counts = new InMemoryCounts();
  const storage = new FakeStorage();
  const useCase = new RegisterCount({
    counts,
    storage,
    ids: new SequentialIds(41),
    clock: fixedClock('2026-10-01T15:00:00Z'),
  });
  return { counts, storage, useCase };
}

describe('RegisterCount', () => {
  it('stores the original image untouched and leaves the count uploaded', async () => {
    const { counts, storage, useCase } = setup();

    const count = await useCase.execute(INPUT);

    expect(count.id).toBe('SIRIUS-CONTEO-0042');
    expect(count.status).toBe('subido');
    expect(count.pastureId).toBe('POTRERO-07');
    expect(count.uploadedAt.toISOString()).toBe('2026-10-01T15:00:00.000Z');
    expect(count.originalImageKey).toBe('counts/SIRIUS-CONTEO-0042/original.jpg');
    expect(storage.puts).toEqual([
      { key: 'counts/SIRIUS-CONTEO-0042/original.jpg', contentType: 'image/jpeg', size: 3 },
    ]);
    expect(counts.saved).toEqual([count]);
  });

  it('rejects unsupported image types without storing anything', async () => {
    const { counts, storage, useCase } = setup();
    await expect(
      useCase.execute({ ...INPUT, image: { ...INPUT.image, contentType: 'image/gif' } }),
    ).rejects.toThrow(InvalidValueError);
    expect(storage.puts).toHaveLength(0);
    expect(counts.saved).toHaveLength(0);
  });

  it('rejects a missing pasture without storing the image', async () => {
    const { storage, useCase } = setup();
    await expect(useCase.execute({ ...INPUT, pastureId: '  ' })).rejects.toThrow(InvalidValueError);
    expect(storage.puts).toHaveLength(0);
  });

  it('rejects an empty image', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ ...INPUT, image: { bytes: new Uint8Array(), contentType: 'image/png' } }),
    ).rejects.toThrow('empty');
  });
});
