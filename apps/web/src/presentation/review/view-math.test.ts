import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  centerOn,
  clampScale,
  fitView,
  hitRadius,
  isInsideImage,
  markRadius,
  minScale,
  nextScale,
  pinchView,
  toImagePoint,
  visibleRegion,
  zoomAround,
} from './view-math';

const IMAGE = { width: 2000, height: 1000 };
const VIEWPORT = { width: 1000, height: 800 };

describe('fitView', () => {
  it('shows the whole image centred, limited by the tighter side', () => {
    expect(fitView(VIEWPORT, IMAGE)).toEqual({ scale: 0.5, tx: 0, ty: 150 });
    expect(minScale(VIEWPORT, IMAGE)).toBe(0.25);
  });
});

describe('zoomAround', () => {
  it('keeps the image pixel under the anchor in place', () => {
    const view = fitView(VIEWPORT, IMAGE);
    const anchor = { x: 300, y: 420 };
    const before = toImagePoint(view, anchor);
    const zoomed = zoomAround(view, 2, anchor);
    expect(zoomed.scale).toBe(2);
    const after = toImagePoint(zoomed, anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('clamps the scale between the given minimum and the maximum', () => {
    expect(clampScale(0.1, 0.25)).toBe(0.25);
    expect(clampScale(20, 0.25)).toBe(MAX_SCALE);
    expect(clampScale(1, 0.25)).toBe(1);
  });
});

describe('nextScale', () => {
  it('clamps a zoom between the viewport minimum and the maximum', () => {
    expect(nextScale(0.5, 0.1, 0.25)).toBe(0.25);
    expect(nextScale(4, 20, 0.25)).toBe(MAX_SCALE);
  });

  it('never zooms in when zooming out from below the minimum', () => {
    // Foto pequeña a tamaño real (1) con un mínimo de 1,37: alejar la deja donde está.
    expect(nextScale(1, 0.8, 1.37)).toBe(1);
    expect(nextScale(1, 1.25, 1.37)).toBe(1.25);
  });

  it('lets an explicit floor go below the minimum, as actual size does', () => {
    expect(nextScale(2.74, 1, 1.37)).toBe(1.37);
    expect(nextScale(2.74, 1, 1.37, 1)).toBe(1);
  });
});

describe('toImagePoint', () => {
  it('converts viewport pixels to original-image pixels', () => {
    const view = { scale: 0.5, tx: 0, ty: 150 };
    expect(toImagePoint(view, { x: 500, y: 400 })).toEqual({ x: 1000, y: 500 });
    expect(isInsideImage({ x: 1000, y: 500 }, IMAGE)).toBe(true);
    expect(isInsideImage(toImagePoint(view, { x: 500, y: 100 }), IMAGE)).toBe(false);
  });
});

describe('visibleRegion', () => {
  it('is the whole image when fitted', () => {
    expect(visibleRegion(fitView(VIEWPORT, IMAGE), VIEWPORT, IMAGE)).toEqual({
      x: 0,
      y: 0,
      width: 2000,
      height: 1000,
    });
  });

  it('is the part under the viewport when zoomed in', () => {
    const view = { scale: 2, tx: -400, ty: -200 };
    expect(visibleRegion(view, VIEWPORT, IMAGE)).toEqual({
      x: 200,
      y: 100,
      width: 500,
      height: 400,
    });
  });

  it('is null when the image is out of view', () => {
    expect(visibleRegion({ scale: 1, tx: 5000, ty: 0 }, VIEWPORT, IMAGE)).toBeNull();
  });
});

describe('centerOn', () => {
  it('puts the image point at the centre of the viewport, keeping the scale', () => {
    const view = centerOn({ scale: 2, tx: 0, ty: 0 }, VIEWPORT, { x: 300, y: 200 });
    expect(view.scale).toBe(2);
    expect(toImagePoint(view, { x: 500, y: 400 })).toEqual({ x: 300, y: 200 });
  });
});

describe('pinchView', () => {
  it('scales with the finger distance and follows the midpoint', () => {
    const start = { scale: 0.5, tx: 0, ty: 150 };
    const startMid = { x: 400, y: 400 };
    const anchor = toImagePoint(start, startMid);
    const mid = { x: 450, y: 380 };
    const view = pinchView(start, startMid, 100, mid, 300, 0.25);
    expect(view.scale).toBeCloseTo(1.5);
    const after = toImagePoint(view, mid);
    expect(after.x).toBeCloseTo(anchor.x);
    expect(after.y).toBeCloseTo(anchor.y);
  });

  it('respects the zoom limits', () => {
    const start = { scale: 0.5, tx: 0, ty: 0 };
    expect(pinchView(start, { x: 0, y: 0 }, 100, { x: 0, y: 0 }, 10, 0.25).scale).toBe(0.25);
    expect(pinchView(start, { x: 0, y: 0 }, 10, { x: 0, y: 0 }, 1000, 0.25).scale).toBe(MAX_SCALE);
  });
});

describe('markRadius', () => {
  it('is 10 image pixels but never under 6 screen pixels', () => {
    expect(markRadius(2)).toBe(10);
    expect(markRadius(0.2)).toBeCloseTo(30);
    expect(hitRadius(1)).toBe(13);
  });
});
