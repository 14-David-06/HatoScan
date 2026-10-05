import { describe, expect, it } from 'vitest';
import { assertReviewConsistent } from '@/domain/index';
import { IMAGE, modelDetection } from '../../../test/fakes';
import { hitTest, initialReviewState, reviewReducer, summarize } from './review-state';

const MODEL = [
  modelDetection('m-1', { x: 100, y: 100 }),
  modelDetection('m-2', { x: 300, y: 300, tipo: 'punto', w: undefined, h: undefined }),
];

describe('reviewReducer', () => {
  it('discards and restores model detections instead of removing them', () => {
    let state = initialReviewState(MODEL);
    state = reviewReducer(state, { type: 'toggle', id: 'm-1' });
    expect(state.detections.find((d) => d.id === 'm-1')?.estado).toBe('descartada');
    expect(summarize(state.detections)).toEqual({
      model: 2,
      confirmed: 1,
      discarded: 1,
      added: 0,
      total: 1,
    });

    state = reviewReducer(state, { type: 'toggle', id: 'm-1' });
    expect(state.detections.find((d) => d.id === 'm-1')?.estado).toBe('activa');
  });

  it('adds human points in original-image pixels, clamped to the image', () => {
    let state = initialReviewState(MODEL);
    state = reviewReducer(state, { type: 'add', x: 10.6, y: 20.2, image: IMAGE });
    state = reviewReducer(state, { type: 'add', x: -5, y: 9000, image: IMAGE });

    expect(state.detections.slice(2)).toEqual([
      { id: 'h-1', x: 11, y: 20, tipo: 'punto', origen: 'humano', estado: 'activa' },
      { id: 'h-2', x: 0, y: IMAGE.height, tipo: 'punto', origen: 'humano', estado: 'activa' },
    ]);
    expect(summarize(state.detections).total).toBe(4);
  });

  it('removes a human mark when toggled and never reuses its id', () => {
    let state = initialReviewState(MODEL);
    state = reviewReducer(state, { type: 'add', x: 1, y: 1, image: IMAGE });
    state = reviewReducer(state, { type: 'toggle', id: 'h-1' });
    state = reviewReducer(state, { type: 'add', x: 2, y: 2, image: IMAGE });
    expect(state.detections.map((d) => d.id)).toEqual(['m-1', 'm-2', 'h-2']);
  });

  it('undoes step by step', () => {
    let state = initialReviewState(MODEL);
    state = reviewReducer(state, { type: 'toggle', id: 'm-2' });
    state = reviewReducer(state, { type: 'add', x: 5, y: 5, image: IMAGE });
    state = reviewReducer(state, { type: 'undo' });
    expect(state.detections).toHaveLength(2);
    state = reviewReducer(state, { type: 'undo' });
    expect(state.detections).toEqual(MODEL);
    expect(reviewReducer(state, { type: 'undo' })).toBe(state);
  });

  it('always produces a review the domain accepts', () => {
    let state = initialReviewState(MODEL);
    state = reviewReducer(state, { type: 'toggle', id: 'm-1' });
    state = reviewReducer(state, { type: 'add', x: 50, y: 50, image: IMAGE });
    state = reviewReducer(state, { type: 'toggle', id: 'h-1' });
    state = reviewReducer(state, { type: 'add', x: 60, y: 60, image: IMAGE });
    expect(() => assertReviewConsistent(MODEL, state.detections)).not.toThrow();
  });
});

describe('hitTest', () => {
  it('finds the nearest detection within the radius, boxes by their edges', () => {
    // m-1 es una caja 15x12 en (100, 100).
    expect(hitTest(MODEL, 110, 105, 5)?.id).toBe('m-1');
    expect(hitTest(MODEL, 118, 105, 5)?.id).toBe('m-1');
    expect(hitTest(MODEL, 302, 299, 5)?.id).toBe('m-2');
    expect(hitTest(MODEL, 200, 200, 5)).toBeUndefined();
  });
});
