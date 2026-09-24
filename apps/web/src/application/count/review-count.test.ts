import { describe, expect, it } from 'vitest';
import { InvalidDetectionError, InvalidTransitionError, toPersonId } from '@/domain/index';
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
import { ProcessCount } from './process-count';
import { ReviewCount } from './review-count';

const REVIEWER = toPersonId('SIRIUS-PER-0007');

async function pendingReview() {
  const counts = new InMemoryCounts(newCount());
  const results = new InMemoryResults();
  await new ProcessCount({
    counts,
    results,
    detector: detectorReturning([modelDetection('a'), modelDetection('b')]),
    storage: new FakeStorage(),
    imageUrlTtlSeconds: 900,
  }).execute({ countId: COUNT_ID });
  const useCase = new ReviewCount({ counts, results, clock: fixedClock('2026-09-21T10:00:00Z') });
  return { counts, results, useCase };
}

describe('ReviewCount', () => {
  it('makes the reviewed total official and stores the reviewed JSON', async () => {
    const { results, useCase } = await pendingReview();

    const count = await useCase.execute({
      countId: COUNT_ID,
      reviewerId: REVIEWER,
      detections: [
        modelDetection('a'),
        modelDetection('b', { estado: 'descartada' }),
        modelDetection('h1', { origen: 'humano' }),
        modelDetection('h2', { origen: 'humano', tipo: 'punto', w: undefined, h: undefined }),
      ],
    });

    expect(count.status).toBe('revisado');
    expect(count.model?.total).toBe(2);
    expect(count.officialTotal).toBe(3);
    expect(count.review?.reviewerId).toBe(REVIEWER);
    const stored = results.reviews.get(count.review?.resultKey ?? '');
    expect(stored?.sourceDetectorVersion).toBe('classic-cv@0.1.0');
    expect(stored?.detections).toHaveLength(4);
  });

  it('does not store anything when the review is inconsistent', async () => {
    const { results, useCase } = await pendingReview();

    await expect(
      useCase.execute({
        countId: COUNT_ID,
        reviewerId: REVIEWER,
        detections: [modelDetection('a')],
      }),
    ).rejects.toThrow(InvalidDetectionError);
    expect(results.reviews.size).toBe(0);
  });

  it('cannot review a count twice', async () => {
    const { useCase } = await pendingReview();
    const detections = [modelDetection('a'), modelDetection('b')];
    await useCase.execute({ countId: COUNT_ID, reviewerId: REVIEWER, detections });

    await expect(
      useCase.execute({ countId: COUNT_ID, reviewerId: REVIEWER, detections }),
    ).rejects.toThrow(InvalidTransitionError);
  });
});
