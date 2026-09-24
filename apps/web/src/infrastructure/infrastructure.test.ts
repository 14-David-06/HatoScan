import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COUNT_ID, DETECTOR, IMAGE, modelDetection } from '../../test/fakes';
import { HttpDetector } from './detector/http-detector';
import { ObjectStorageResultStore } from './results/object-storage-result-store';
import { InMemoryObjectStorage } from './storage/in-memory-object-storage';

const example: unknown = JSON.parse(
  readFileSync(
    new URL('../../../../packages/contracts/examples/count-result.example.json', import.meta.url),
    'utf8',
  ),
);

const respondWith = (body: unknown, status = 200): typeof fetch =>
  (() => Promise.resolve(Response.json(body, { status }))) as typeof fetch;

const detectorWith = (fetchImpl: typeof fetch) =>
  new HttpDetector({ baseUrl: 'http://detector.test', timeoutMs: 1000, fetch: fetchImpl });

describe('HttpDetector', () => {
  const input = { countId: COUNT_ID, imageUrl: 'https://storage.test/img.jpg' };

  it('maps a valid contract response to the domain', async () => {
    const output = await detectorWith(respondWith(example)).detect(input);
    expect(output.detector.version).toBe('classic-cv@0.1.0');
    expect(output.detections).toHaveLength(2);
    expect(output.detections[1]).not.toHaveProperty('w');
  });

  it('rejects a response that breaks the contract', async () => {
    const broken = { ...(example as object), detections: [{ id: 'x' }] };
    await expect(detectorWith(respondWith(broken)).detect(input)).rejects.toThrow(
      /Invalid detector response/,
    );
  });

  it('rejects a total that does not match the active detections', async () => {
    const wrongTotal = { ...(example as object), total: 5 };
    await expect(detectorWith(respondWith(wrongTotal)).detect(input)).rejects.toThrow(
      /does not match/,
    );
  });

  it('surfaces HTTP errors', async () => {
    await expect(detectorWith(respondWith({ detail: 'boom' }, 503)).detect(input)).rejects.toThrow(
      /503/,
    );
  });
});

describe('ObjectStorageResultStore', () => {
  it('round-trips the model result through the contract', async () => {
    const store = new ObjectStorageResultStore(new InMemoryObjectStorage());
    const output = {
      detector: DETECTOR,
      params: { min_area_px: 40 },
      image: IMAGE,
      detections: [modelDetection('a'), modelDetection('b', { estado: 'descartada' })],
    };

    const key = await store.saveModelResult(COUNT_ID, output);

    expect(key).toBe('counts/SIRIUS-CONTEO-0001/model-result.json');
    expect(await store.loadModelResult(key)).toEqual(output);
  });
});
