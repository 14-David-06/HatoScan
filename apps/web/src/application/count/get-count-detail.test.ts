import { describe, expect, it } from 'vitest';
import { toCountId, toPersonId } from '@/domain/index';
import {
  COUNT_ID,
  detectorReturning,
  FakeStorage,
  fixedClock,
  InMemoryCounts,
  InMemoryResults,
  modelDetection,
  newCount,
} from '../../../test/fakes';
import { CountNotFoundError } from '../errors';
import { GetCountDetail } from './get-count-detail';
import { ProcessCount } from './process-count';
import { ReviewCount } from './review-count';

function setup() {
  const counts = new InMemoryCounts(newCount());
  const results = new InMemoryResults();
  const storage = new FakeStorage();
  const detail = new GetCountDetail({ counts, results, storage, imageUrlTtlSeconds: 600 });
  const process = new ProcessCount({
    counts,
    results,
    storage,
    detector: detectorReturning([modelDetection('a'), modelDetection('b')]),
  });
  const review = new ReviewCount({ counts, results, clock: fixedClock('2026-10-02T10:00:00Z') });
  return { detail, process, review };
}

describe('GetCountDetail', () => {
  it('returns only the image for an uploaded count', async () => {
    const { detail } = setup();
    const result = await detail.execute(COUNT_ID);
    expect(result.count.status).toBe('subido');
    expect(result.imageUrl).toContain('original.jpg');
    expect(result.model).toBeUndefined();
    expect(result.review).toBeUndefined();
  });

  it('includes the model and review detections once they exist', async () => {
    const { detail, process, review } = setup();
    await process.execute({ countId: COUNT_ID });
    expect((await detail.execute(COUNT_ID)).model?.detections).toHaveLength(2);

    await review.execute({
      countId: COUNT_ID,
      reviewerId: toPersonId('SIRIUS-PER-0001'),
      detections: [modelDetection('a'), modelDetection('b', { estado: 'descartada' })],
    });
    const result = await detail.execute(COUNT_ID);
    expect(result.review?.detections).toHaveLength(2);
    expect(result.count.officialTotal).toBe(1);
  });

  it('fails for an unknown count', async () => {
    const { detail } = setup();
    await expect(detail.execute(toCountId('SIRIUS-CONTEO-9999'))).rejects.toThrow(
      CountNotFoundError,
    );
  });
});
