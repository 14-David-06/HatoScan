import { describe, expect, it } from 'vitest';
import { InvalidValueError } from '@/domain/index';
import { FakeStorage, fixedClock, InMemoryCounts, SequentialIds } from '../../../test/fakes';
import { RegisterCount, type RegisterCountInput } from './register-count';

const UPLOAD_KEY = 'uploads/0b6f3c1e-9a2d-4f5b-8c7e-1d2a3b4c5d6e.jpg';

const INPUT: RegisterCountInput = {
  farm: ' Guaicaramo ',
  pastureId: ' POTRERO-07 ',
  species: 'bufala',
  flightDate: new Date('2026-09-30T07:00:00Z'),
  flight: { altitudeM: 90, cameraAngleDeg: 90 },
  uploadKey: UPLOAD_KEY,
};

function setup(
  uploaded: { size: number; contentType: string } | null = {
    size: 3,
    contentType: 'image/jpeg',
  },
) {
  const counts = new InMemoryCounts();
  const storage = new FakeStorage();
  if (uploaded) storage.objects.set(UPLOAD_KEY, uploaded);
  const useCase = new RegisterCount({
    counts,
    storage,
    ids: new SequentialIds(41),
    clock: fixedClock('2026-10-01T15:00:00Z'),
  });
  return { counts, storage, useCase };
}

describe('RegisterCount', () => {
  it('moves the uploaded image untouched under the count and leaves it uploaded', async () => {
    const { counts, storage, useCase } = setup();

    const count = await useCase.execute(INPUT);

    expect(count.id).toBe('SIRIUS-CONTEO-0042');
    expect(count.status).toBe('subido');
    expect(count.farm).toBe('Guaicaramo');
    expect(count.pastureId).toBe('POTRERO-07');
    expect(count.uploadedAt.toISOString()).toBe('2026-10-01T15:00:00.000Z');
    expect(count.originalImageKey).toBe('counts/SIRIUS-CONTEO-0042/original.jpg');
    expect(storage.copies).toEqual([
      { from: UPLOAD_KEY, to: 'counts/SIRIUS-CONTEO-0042/original.jpg' },
    ]);
    expect(storage.deletes).toEqual([UPLOAD_KEY]);
    expect(storage.puts).toHaveLength(0);
    expect(counts.saved).toEqual([count]);
  });

  it('rejects keys outside the upload area', async () => {
    const { storage, useCase } = setup();
    await expect(
      useCase.execute({ ...INPUT, uploadKey: 'counts/SIRIUS-CONTEO-0001/original.jpg' }),
    ).rejects.toThrow(InvalidValueError);
    expect(storage.copies).toHaveLength(0);
  });

  it('rejects an image that never reached the storage', async () => {
    const { counts, useCase } = setup(null);
    await expect(useCase.execute(INPUT)).rejects.toThrow('not uploaded');
    expect(counts.saved).toHaveLength(0);
  });

  it('rejects a stored type that does not match the key', async () => {
    const { storage, useCase } = setup({ size: 3, contentType: 'image/gif' });
    await expect(useCase.execute(INPUT)).rejects.toThrow(InvalidValueError);
    expect(storage.copies).toHaveLength(0);
  });

  it('rejects and deletes an empty or oversized upload', async () => {
    const empty = setup({ size: 0, contentType: 'image/jpeg' });
    await expect(empty.useCase.execute(INPUT)).rejects.toThrow('empty');
    expect(empty.storage.deletes).toEqual([UPLOAD_KEY]);

    const huge = setup({ size: 81 * 1024 * 1024, contentType: 'image/jpeg' });
    await expect(huge.useCase.execute(INPUT)).rejects.toThrow('exceeds');
    expect(huge.storage.copies).toHaveLength(0);
  });

  it('rejects a missing farm without moving the image', async () => {
    const { storage, useCase } = setup();
    await expect(useCase.execute({ ...INPUT, farm: ' ' })).rejects.toThrow(InvalidValueError);
    expect(storage.copies).toHaveLength(0);
  });

  it('rejects a missing pasture without moving the image', async () => {
    const { storage, useCase } = setup();
    await expect(useCase.execute({ ...INPUT, pastureId: '  ' })).rejects.toThrow(InvalidValueError);
    expect(storage.copies).toHaveLength(0);
  });
});
