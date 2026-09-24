import { InvalidValueError } from '../errors';

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** `SIRIUS-CONTEO-XXXX`: identificador de un conteo en la arquitectura federada de Sirius Verse. */
export type CountId = Brand<string, 'CountId'>;

/** `SIRIUS-PER-XXXX`: FK simbólica a la persona que revisa. */
export type PersonId = Brand<string, 'PersonId'>;

const COUNT_ID_PATTERN = /^SIRIUS-CONTEO-\d{4,}$/;
const PERSON_ID_PATTERN = /^SIRIUS-PER-\d{4,}$/;

export function toCountId(value: string): CountId {
  if (!COUNT_ID_PATTERN.test(value)) {
    throw new InvalidValueError(`Invalid count id: "${value}"`);
  }
  return value as CountId;
}

export function toPersonId(value: string): PersonId {
  if (!PERSON_ID_PATTERN.test(value)) {
    throw new InvalidValueError(`Invalid person id: "${value}"`);
  }
  return value as PersonId;
}
