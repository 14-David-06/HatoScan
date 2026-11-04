import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toPersonId } from '@/domain/index';
import { COUNT_ID, DETECTOR, IMAGE, newCount } from '../../test/fakes';
import { JsonFileCountRepository } from './counts/json-file-count-repository';
import { LocalFsObjectStorage } from './storage/local-fs-object-storage';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hatoscan-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('LocalFsObjectStorage', () => {
  let now = new Date('2026-10-01T12:00:00Z');
  const storage = () =>
    new LocalFsObjectStorage({
      rootDir: dir,
      publicBaseUrl: 'http://localhost:3000',
      signingSecret: 'test-secret',
      now: () => now,
    });

  const signedFrom = (url: string) => {
    const parsed = new URL(url);
    return {
      key: parsed.pathname.replace('/api/files/', ''),
      expires: parsed.searchParams.get('expires'),
      signature: parsed.searchParams.get('signature'),
    };
  };

  it('stores bytes untouched and serves them through a signed url', async () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    await storage().put('counts/SIRIUS-CONTEO-0001/original.jpg', bytes);

    const url = await storage().getReadUrl('counts/SIRIUS-CONTEO-0001/original.jpg', 60);
    const object = await storage().readSigned(signedFrom(url));

    expect(object?.contentType).toBe('image/jpeg');
    expect([...(object?.body ?? [])]).toEqual([1, 2, 3, 250]);
  });

  it('refuses expired or tampered urls', async () => {
    await storage().put('a/b.png', new Uint8Array([1]));
    const signed = signedFrom(await storage().getReadUrl('a/b.png', 60));

    expect(await storage().readSigned({ ...signed, key: 'a/c.png' })).toBeUndefined();
    expect(await storage().readSigned({ ...signed, signature: 'ab'.repeat(32) })).toBeUndefined();

    now = new Date(now.getTime() + 61_000);
    expect(await storage().readSigned(signed)).toBeUndefined();
  });

  it('rejects keys that escape the root folder', async () => {
    await expect(storage().put('../evil.jpg', new Uint8Array([1]))).rejects.toThrow(
      /Invalid object key/,
    );
    await expect(storage().get('a/../../evil.jpg')).rejects.toThrow(/Invalid object key/);
  });

  it('accepts a signed upload only with its own url and the type of the key', async () => {
    const target = await storage().getUploadUrl('uploads/u.jpg', 'image/jpeg', 60);
    const signed = signedFrom(target.url);
    const body = new Uint8Array([9, 8, 7]);

    // Una URL de lectura no sirve para escribir.
    const readUrl = signedFrom(await storage().getReadUrl('uploads/u.jpg', 60));
    expect(await storage().writeSigned({ ...readUrl, body, contentType: 'image/jpeg' })).toBe(
      false,
    );
    expect(await storage().writeSigned({ ...signed, body, contentType: 'image/png' })).toBe(false);
    expect(await storage().writeSigned({ ...signed, body, contentType: 'image/jpeg' })).toBe(true);

    expect(await storage().stat('uploads/u.jpg')).toEqual({ size: 3, contentType: 'image/jpeg' });
    // Y una de subida no sirve para leer.
    expect(await storage().readSigned(signed)).toBeUndefined();
  });

  it('copies, deletes and reports missing objects', async () => {
    await storage().put('uploads/u.png', new Uint8Array([1, 2]));
    await storage().copy('uploads/u.png', 'counts/SIRIUS-CONTEO-0001/original.png');
    await storage().delete('uploads/u.png');
    await storage().delete('uploads/u.png');

    expect(await storage().stat('uploads/u.png')).toBeUndefined();
    expect([...(await storage().get('counts/SIRIUS-CONTEO-0001/original.png'))]).toEqual([1, 2]);
  });
});

describe('JsonFileCountRepository', () => {
  const repository = () => new JsonFileCountRepository(join(dir, 'counts.json'));

  it('round-trips a reviewed count through the file', async () => {
    const reviewed = newCount()
      .startProcessing()
      .proposeDetections({
        detector: DETECTOR,
        params: { min_area_px: 40 },
        image: IMAGE,
        total: 2,
        resultKey: 'counts/x/model-result.json',
      })
      .completeReview({
        reviewerId: toPersonId('SIRIUS-PER-0003'),
        reviewedAt: new Date('2026-10-02T09:00:00Z'),
        total: 3,
        resultKey: 'counts/x/review-result.json',
      });

    await repository().save(newCount());
    await repository().save(reviewed);

    const loaded = await repository().findById(COUNT_ID);
    expect(loaded?.toProps()).toEqual(reviewed.toProps());
    expect(await repository().list()).toHaveLength(1);
  });

  it('hands out consecutive ids, even under concurrent calls', async () => {
    const repo = repository();
    const ids = await Promise.all([repo.next(), repo.next(), repo.next()]);
    expect(ids).toEqual(['SIRIUS-CONTEO-0001', 'SIRIUS-CONTEO-0002', 'SIRIUS-CONTEO-0003']);
    expect(await repository().next()).toBe('SIRIUS-CONTEO-0004');
  });

  it('returns nothing when the file does not exist yet', async () => {
    expect(await repository().findById(COUNT_ID)).toBeUndefined();
    expect(await repository().list()).toEqual([]);
  });
});
