import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toDetectorVersion } from '@/domain/index';
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

  it('maps the method catalog', async () => {
    const catalog = {
      default_detector: 'classic-cv',
      detectors: [
        { name: 'classic-cv', version: '0.2.0', label: 'A', description: 'a', available: true },
        { name: 'yolo-sahi', version: '0.0.0', label: 'B', description: 'b', available: false },
      ],
    };
    const result = await detectorWith(respondWith(catalog)).methods();
    expect(result.defaultMethod).toBe('classic-cv');
    expect(result.methods.map((m) => [m.name, m.available])).toEqual([
      ['classic-cv', true],
      ['yolo-sahi', false],
    ]);
  });

  it('rejects an invalid catalog', async () => {
    await expect(detectorWith(respondWith({ detectors: [] })).methods()).rejects.toThrow(
      /Invalid detector catalog/,
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

    expect(key).toBe(
      `counts/SIRIUS-CONTEO-0001/model-results/classic-cv-0.1.0-${'a'.repeat(12)}.json`,
    );
    expect(await store.loadModelResult(key)).toEqual(output);
  });

  it('keeps one model result per method, so detecting again does not overwrite', async () => {
    const store = new ObjectStorageResultStore(new InMemoryObjectStorage());
    const base = { params: {}, image: IMAGE, detections: [modelDetection('a')] };
    const first = await store.saveModelResult(COUNT_ID, { ...base, detector: DETECTOR });
    const second = await store.saveModelResult(COUNT_ID, {
      ...base,
      detector: toDetectorVersion('classic-cv-dark@0.1.0', 'b'.repeat(64)),
    });
    expect(first).not.toBe(second);
    expect((await store.loadModelResult(first)).detector).toEqual(DETECTOR);
  });
});
