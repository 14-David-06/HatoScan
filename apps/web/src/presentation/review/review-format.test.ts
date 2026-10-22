import { describe, expect, it } from 'vitest';
import { digitSlots, formatAnimals, formatZoom } from './review-format';

/** Espacio fino de no separación: separador de miles y antes de «%». */
const NNBSP = String.fromCharCode(0x202f);

describe('digitSlots', () => {
  it('keys digits by their place from the right so columns keep their identity', () => {
    expect(digitSlots(7)).toEqual([{ key: 'd0', char: '7', digit: 7 }]);
    expect(digitSlots(120).map((s) => s.key)).toEqual(['d2', 'd1', 'd0']);
    expect(digitSlots(99).at(-1)?.key).toBe(digitSlots(100).at(-1)?.key);
  });

  it('keeps the thousands separator as a slot without digit', () => {
    expect(digitSlots(1203)).toEqual([
      { key: 'd3', char: '1', digit: 1 },
      { key: 's0', char: NNBSP },
      { key: 'd2', char: '2', digit: 2 },
      { key: 'd1', char: '0', digit: 0 },
      { key: 'd0', char: '3', digit: 3 },
    ]);
  });
});

describe('formatZoom', () => {
  it('reads the scale as a percentage of the original resolution', () => {
    expect(formatZoom(1)).toBe(`100${NNBSP}%`);
    expect(formatZoom(0.5416)).toBe(`54${NNBSP}%`);
    expect(formatZoom(8)).toBe(`800${NNBSP}%`);
  });
});

describe('formatAnimals', () => {
  it('agrees in number', () => {
    expect(formatAnimals(1)).toBe('1 animal');
    expect(formatAnimals(0)).toBe('0 animales');
    expect(formatAnimals(1200)).toBe(`1${NNBSP}200 animales`);
  });
});
