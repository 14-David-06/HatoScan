import { describe, expect, it } from 'vitest';
import { formatElapsed } from './elapsed';

describe('formatElapsed', () => {
  it('muestra minutos y segundos con dos cifras', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7_400)).toBe('0:07');
    expect(formatElapsed(59_999)).toBe('0:59');
    expect(formatElapsed(60_000)).toBe('1:00');
    expect(formatElapsed(222_000)).toBe('3:42');
    expect(formatElapsed(725_000)).toBe('12:05');
  });

  it('no muestra tiempos negativos', () => {
    expect(formatElapsed(-1_000)).toBe('0:00');
  });
});
