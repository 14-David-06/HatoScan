import { describe, expect, it } from 'vitest';
import { IMAGE, modelDetection } from '../../../test/fakes';
import { InvalidDetectionError } from '../errors';
import { assertValidDetection, assertValidDetections, countActive } from './detection';
import { assertReviewConsistent } from './review';

describe('detections', () => {
  it('counts only active detections', () => {
    const detections = [
      modelDetection('a'),
      modelDetection('b', { estado: 'descartada' }),
      modelDetection('c'),
    ];
    expect(countActive(detections)).toBe(2);
  });

  it.each([
    ['negative x', { x: -1 }],
    ['box beyond right edge', { x: IMAGE.width - 5, w: 10 }],
    ['box without size', { w: undefined }],
    ['score above 1', { score: 1.2 }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => assertValidDetection(modelDetection('a', overrides), IMAGE)).toThrow(
      InvalidDetectionError,
    );
  });

  it('rejects a point with size', () => {
    const point = modelDetection('a', { tipo: 'punto' });
    expect(() => assertValidDetection(point, IMAGE)).toThrow(InvalidDetectionError);
  });

  it('rejects duplicate ids', () => {
    expect(() => assertValidDetections([modelDetection('a'), modelDetection('a')], IMAGE)).toThrow(
      InvalidDetectionError,
    );
  });
});

describe('review consistency', () => {
  const model = [modelDetection('a'), modelDetection('b')];

  it('accepts discards and human additions', () => {
    const reviewed = [
      modelDetection('a'),
      modelDetection('b', { estado: 'descartada' }),
      modelDetection('h1', { origen: 'humano' }),
    ];
    expect(() => assertReviewConsistent(model, reviewed)).not.toThrow();
  });

  it('rejects removing a model detection instead of discarding it', () => {
    expect(() => assertReviewConsistent(model, [modelDetection('a')])).toThrow(/discard it/);
  });

  it('rejects new detections not marked as human', () => {
    const reviewed = [...model, modelDetection('x')];
    expect(() => assertReviewConsistent(model, reviewed)).toThrow(/origen "humano"/);
  });
});
