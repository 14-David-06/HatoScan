/**
 * Formatos de presentación en español. Deterministas a propósito (sin `Intl`): el servidor y el
 * navegador deben producir el mismo texto para que la hidratación no difiera.
 */

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** `2026-09-23` o ISO completo → `23 sep 2026`. Fecha de calendario, sin zona horaria. */
export function formatDate(value: string, month: 'short' | 'long' = 'short'): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, mm, dd] = match;
  const index = Number(mm) - 1;
  const name = month === 'long' ? MONTHS_LONG[index] : MONTHS_SHORT[index];
  if (name === undefined) return value;
  return month === 'long' ? `${Number(dd)} de ${name} de ${year}` : `${Number(dd)} ${name} ${year}`;
}

/** Entero con separador de miles español: `12 480`. */
export function formatInteger(value: number): string {
  const sign = value < 0 ? '−' : '';
  const digits = String(Math.abs(Math.trunc(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Diferencia con signo explícito: `+2`, `−3`, `0`. */
export function formatDifference(value: number): string {
  if (value > 0) return `+${formatInteger(value)}`;
  return formatInteger(value);
}

/** Tamaño de archivo legible: `24,6 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'] as const;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 ? Math.round(value).toString() : value.toFixed(1);
  return `${rounded.replace('.', ',')} ${units[unit]}`;
}

/** Dimensiones de una imagen: `5472 × 3648 px`. */
export function formatDimensions(width: number, height: number): string {
  return `${formatInteger(width)} × ${formatInteger(height)} px`;
}
