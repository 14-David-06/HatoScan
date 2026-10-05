import { describe, expect, it } from 'vitest';
import { DETECTOR, IMAGE, newCount } from '../../../test/fakes';
import { InvalidTransitionError, InvalidValueError } from '../errors';
import { toPersonId } from './count-id';

const proposal = { detector: DETECTOR, params: {}, image: IMAGE, total: 3, resultKey: 'm.json' };
const review = {
  reviewerId: toPersonId('SIRIUS-PER-0007'),
  reviewedAt: new Date('2026-09-21T10:00:00Z'),
  total: 4,
  resultKey: 'r.json',
};

describe('Count', () => {
  it('starts as subido with no official total', () => {
    const count = newCount();
    expect(count.status).toBe('subido');
    expect(count.officialTotal).toBeUndefined();
  });

  it('only gets an official total after human review', () => {
    const proposed = newCount().startProcessing().proposeDetections(proposal);
    expect(proposed.status).toBe('pendiente_revision');
    expect(proposed.officialTotal).toBeUndefined();

    const reviewed = proposed.completeReview(review);
    expect(reviewed.status).toBe('revisado');
    expect(reviewed.officialTotal).toBe(4);
    expect(reviewed.model?.total).toBe(3);
  });

  it('is immutable', () => {
    const count = newCount();
    count.startProcessing();
    expect(count.status).toBe('subido');
  });

  it('cannot be reviewed before the model proposes', () => {
    expect(() => newCount().startProcessing().completeReview(review)).toThrow(
      InvalidTransitionError,
    );
  });

  it('keeps the error message when processing fails', () => {
    const failed = newCount().startProcessing().fail('Detector timeout');
    expect(failed.status).toBe('error');
    expect(failed.errorMessage).toBe('Detector timeout');
  });

  it('can detect again before review, dropping the previous proposal and error', () => {
    const proposed = newCount().startProcessing().proposeDetections(proposal);
    const again = proposed.startProcessing();
    expect(again.status).toBe('procesando');
    expect(again.model).toBeUndefined();

    const retried = newCount().startProcessing().fail('Detector timeout').startProcessing();
    expect(retried.status).toBe('procesando');
    expect(retried.errorMessage).toBeUndefined();
  });

  it('cannot detect again once reviewed', () => {
    const reviewed = newCount()
      .startProcessing()
      .proposeDetections(proposal)
      .completeReview(review);
    expect(() => reviewed.startProcessing()).toThrow(InvalidTransitionError);
  });

  it('requires an error message', () => {
    expect(() => newCount().startProcessing().fail('  ')).toThrow(InvalidValueError);
  });
});
