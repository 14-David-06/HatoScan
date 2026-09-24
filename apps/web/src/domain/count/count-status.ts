import { InvalidTransitionError } from '../errors';

export const COUNT_STATUSES = [
  'subido',
  'procesando',
  'pendiente_revision',
  'revisado',
  'error',
] as const;

export type CountStatus = (typeof COUNT_STATUSES)[number];

/** Única fuente de verdad de las transiciones permitidas. Cualquier otra es un error. */
const TRANSITIONS: Readonly<Record<CountStatus, readonly CountStatus[]>> = {
  subido: ['procesando'],
  procesando: ['pendiente_revision', 'error'],
  pendiente_revision: ['revisado'],
  revisado: [],
  error: [],
};

export function canTransition(from: CountStatus, to: CountStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: CountStatus, to: CountStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(`Invalid count transition: ${from} -> ${to}`);
  }
}
