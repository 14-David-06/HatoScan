import { describe, expect, it } from 'vitest';
import {
  COUNT_ID,
  detectorReturning,
  FakeDetector,
  FakeStorage,
  InMemoryCounts,
  InMemoryResults,
  modelDetection,
  newCount,
} from '../../../test/fakes';
import { CountNotFoundError } from '../errors';
import { ProcessCount } from './process-count';

function setup(detector: FakeDetector) {
  const counts = new InMemoryCounts(newCount());
  const results = new InMemoryResults();
  const useCase = new ProcessCount({
    counts,
    detector,
    results,
    storage: new FakeStorage(),
  });
  return { counts, results, useCase };
}

describe('ProcessCount', () => {
  it('leaves the count pending review with the model proposal', async () => {
    const detector = detectorReturning([
      modelDetection('a'),
      modelDetection('b', { estado: 'descartada' }),
    ]);
    const { counts, results, useCase } = setup(detector);

    const count = await useCase.execute({ countId: COUNT_ID });

    expect(count.status).toBe('pendiente_revision');
    expect(count.model?.total).toBe(1);
    expect(count.officialTotal).toBeUndefined();
    expect(results.models.has(count.model?.resultKey ?? '')).toBe(true);
    expect(counts.saved.map((c) => c.status)).toEqual(['procesando', 'pendiente_revision']);
    expect(detector.calls[0]?.image).toEqual(
      FakeStorage.bytesOf('counts/SIRIUS-CONTEO-0001/original.jpg'),
    );
  });

  it('marks the count as error with the message when the detector fails', async () => {
    const { counts, useCase } = setup(
      new FakeDetector(() => Promise.reject(new Error('Claude API error 529'))),
    );

    const count = await useCase.execute({ countId: COUNT_ID });

    expect(count.status).toBe('error');
    expect(count.errorMessage).toContain('Claude API error 529');
    expect(counts.saved.map((c) => c.status)).toEqual(['procesando', 'error']);
  });

  it('rejects detections outside the image instead of fixing them', async () => {
    const { useCase } = setup(detectorReturning([modelDetection('a', { x: 5000 })]));
    const count = await useCase.execute({ countId: COUNT_ID });
    expect(count.status).toBe('error');
    expect(count.errorMessage).toContain('outside image');
  });

  it('rejects detector output claiming human origin', async () => {
    const { useCase } = setup(detectorReturning([modelDetection('a', { origen: 'humano' })]));
    const count = await useCase.execute({ countId: COUNT_ID });
    expect(count.status).toBe('error');
  });

  it('detects again with another method, replacing the pending proposal', async () => {
    const detector = detectorReturning([modelDetection('a'), modelDetection('b')]);
    const { counts, useCase } = setup(detector);
    await useCase.execute({ countId: COUNT_ID });

    const again = await useCase.execute({ countId: COUNT_ID, detector: 'claude-vision-sonnet' });

    expect(again.status).toBe('pendiente_revision');
    expect(detector.calls.map((c) => c.detector)).toEqual([undefined, 'claude-vision-sonnet']);
    expect(counts.saved.map((c) => c.status)).toEqual([
      'procesando',
      'pendiente_revision',
      'procesando',
      'pendiente_revision',
    ]);
  });

  it('retries a count that ended in error', async () => {
    let attempt = 0;
    const detector = new FakeDetector(() =>
      ++attempt === 1
        ? Promise.reject(new Error('Claude API error 529'))
        : detectorReturning([modelDetection('a')]).detect({
            countId: COUNT_ID,
            image: new Uint8Array(),
          }),
    );
    const { useCase } = setup(detector);
    expect((await useCase.execute({ countId: COUNT_ID })).status).toBe('error');

    const retried = await useCase.execute({ countId: COUNT_ID });
    expect(retried.status).toBe('pendiente_revision');
    expect(retried.errorMessage).toBeUndefined();
  });

  it('fails when the count does not exist', async () => {
    const useCase = new ProcessCount({
      counts: new InMemoryCounts(),
      detector: detectorReturning([]),
      results: new InMemoryResults(),
      storage: new FakeStorage(),
    });
    await expect(useCase.execute({ countId: COUNT_ID })).rejects.toThrow(CountNotFoundError);
  });
});
