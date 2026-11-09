import { createHash } from 'node:crypto';

/** JSON canónico: claves ordenadas en todos los niveles y sin espacios. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

/** SHA-256 hex del JSON canónico de los parámetros usados en una detección. */
export function paramsHash(params: Readonly<Record<string, unknown>>): string {
  return createHash('sha256').update(canonicalJson(params), 'utf8').digest('hex');
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])]),
    );
  }
  return value;
}
