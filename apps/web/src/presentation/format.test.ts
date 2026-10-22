import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatDate,
  formatDifference,
  formatDimensions,
  formatInteger,
} from './format';

describe('formatDate', () => {
  it('formats calendar dates in Spanish without time zone shifts', () => {
    expect(formatDate('2026-09-23')).toBe('23 sep 2026');
    expect(formatDate('2026-01-05T23:59:00.000Z')).toBe('5 ene 2026');
    expect(formatDate('2026-12-01', 'long')).toBe('1 de diciembre de 2026');
  });

  it('returns the input when it is not a date', () => {
    expect(formatDate('ayer')).toBe('ayer');
    expect(formatDate('2026-13-01')).toBe('2026-13-01');
  });
});

describe('formatInteger', () => {
  it('groups thousands with a narrow space', () => {
    expect(formatInteger(120)).toBe('120');
    expect(formatInteger(12480)).toBe('12 480');
    expect(formatInteger(-1500)).toBe('−1 500');
  });
});

describe('formatDifference', () => {
  it('always shows the sign', () => {
    expect(formatDifference(2)).toBe('+2');
    expect(formatDifference(-3)).toBe('−3');
    expect(formatDifference(0)).toBe('0');
  });
});

describe('formatBytes', () => {
  it('uses a decimal comma', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(25_800_000)).toBe('24,6 MB');
  });
});

describe('formatDimensions', () => {
  it('joins width and height', () => {
    expect(formatDimensions(5472, 3648)).toBe('5 472 × 3 648 px');
  });
});
