import { describe, expect, it } from 'vitest';
import { cornersPath, nearestMark, type MarkBox } from '../assets/marks';
import {
  addAtMs,
  appearAtMs,
  confirmedTotal,
  DISCARD_AT_MS,
  doneAtMs,
  frameAt,
  SCAN_MS,
  SCAN_START_MS,
  type HeroScript,
} from './hero-timeline';

const box = (x: number, y: number): MarkBox => ({ x, y, w: 40, h: 20 });

const falsePositive = box(50, 900);
const script: HeroScript = {
  imageHeight: 1000,
  proposed: [box(10, 0), box(20, 500), falsePositive],
  falsePositive,
  missed: [box(30, 300), box(40, 700)],
};

describe('hero timeline', () => {
  it('shows each proposal when the sweep reaches its centre', () => {
    expect(appearAtMs(box(0, 0), 1000)).toBe(SCAN_START_MS);
    expect(appearAtMs(box(0, 500), 1000)).toBe(SCAN_START_MS + SCAN_MS / 2);
    expect(frameAt(SCAN_START_MS + SCAN_MS / 2, script)).toEqual({ stage: 'scan', count: 2 });
  });

  it('counts down the discarded proposal and up each added animal during review', () => {
    expect(frameAt(DISCARD_AT_MS - 1, script)).toEqual({ stage: 'scan', count: 3 });
    expect(frameAt(DISCARD_AT_MS, script)).toEqual({ stage: 'review', count: 2 });
    expect(frameAt(addAtMs(0), script)).toEqual({ stage: 'review', count: 3 });
    expect(frameAt(addAtMs(1), script)).toEqual({ stage: 'review', count: 4 });
  });

  it('ends on the confirmed total: proposals minus the mistake plus the missed ones', () => {
    expect(confirmedTotal(script)).toBe(4);
    expect(doneAtMs(script)).toBeGreaterThan(addAtMs(1));
    expect(frameAt(doneAtMs(script), script)).toEqual({ stage: 'done', count: 4 });
    expect(frameAt(Number.POSITIVE_INFINITY, script)).toEqual({ stage: 'done', count: 4 });
  });
});

describe('marks helpers', () => {
  it('finds the mark nearest to a point', () => {
    const marks = { width: 100, height: 100, animals: [box(10, 10), box(80, 80)] };
    expect(nearestMark(marks, 70, 90)).toEqual(box(80, 80));
    expect(() => nearestMark({ width: 1, height: 1, animals: [] }, 0, 0)).toThrow();
  });

  it('draws four corners around the padded box', () => {
    // Caja 40×20 en (50, 50) con margen 5: de (25, 35) a (75, 65); esquina de 30 × 0.32 ≈ 10.
    expect(cornersPath(box(50, 50), 5)).toBe('M25 45V35H35M65 35H75V45M75 55V65H65M35 65H25V55');
  });
});
