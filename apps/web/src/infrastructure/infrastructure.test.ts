import { describe, expect, it } from 'vitest';
import { toDetectorVersion } from '@/domain/index';
import { COUNT_ID, DETECTOR, IMAGE, modelDetection } from '../../test/fakes';
import { ObjectStorageResultStore } from './results/object-storage-result-store';
import { InMemoryObjectStorage } from './storage/in-memory-object-storage';

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
      `counts/SIRIUS-CONTEO-0001/model-results/claude-vision-0.3.0-${'a'.repeat(12)}.json`,
    );
    expect(await store.loadModelResult(key)).toEqual(output);
  });

  it('keeps one model result per method, so detecting again does not overwrite', async () => {
    const store = new ObjectStorageResultStore(new InMemoryObjectStorage());
    const base = { params: {}, image: IMAGE, detections: [modelDetection('a')] };
    const first = await store.saveModelResult(COUNT_ID, { ...base, detector: DETECTOR });
    const second = await store.saveModelResult(COUNT_ID, {
      ...base,
      detector: toDetectorVersion('claude-vision-sonnet@0.3.0', 'b'.repeat(64)),
    });
    expect(first).not.toBe(second);
    expect((await store.loadModelResult(first)).detector).toEqual(DETECTOR);
  });
});
