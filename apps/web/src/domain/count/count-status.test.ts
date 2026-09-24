import { describe, expect, it } from 'vitest';
import { InvalidTransitionError } from '../errors';
import { assertTransition, canTransition, COUNT_STATUSES, type CountStatus } from './count-status';

const ALLOWED: ReadonlyArray<[CountStatus, CountStatus]> = [
  ['subido', 'procesando'],
  ['procesando', 'pendiente_revision'],
  ['procesando', 'error'],
  ['pendiente_revision', 'revisado'],
];

describe('count status machine', () => {
  it.each(ALLOWED)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it('rejects every other transition', () => {
    for (const from of COUNT_STATUSES) {
      for (const to of COUNT_STATUSES) {
        const allowed = ALLOWED.some(([f, t]) => f === from && t === to);
        if (!allowed) expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
      }
    }
  });
});
