import type { CountStatus } from '@/domain/index';
import type { CountSummaryView } from '../view-models';

/** Parámetro de la URL que guarda el filtro (`/?estado=pendientes`), para poder enlazarlo. */
export const STATUS_FILTER_PARAM = 'estado';

export type StatusGroupKey = 'pendientes' | 'revisados' | 'en-proceso' | 'error';
export type StatusFilter = 'todos' | StatusGroupKey;

export interface StatusGroup {
  readonly key: StatusGroupKey;
  readonly label: string;
  readonly statuses: readonly CountStatus[];
}

/**
 * Grupos del resumen y del filtro, en el orden de la barra. «Subido» y «procesando» van juntos:
 * en ambos el detector aún no ha terminado y nadie puede actuar todavía.
 */
export const STATUS_GROUPS: readonly StatusGroup[] = [
  { key: 'pendientes', label: 'Por revisar', statuses: ['pendiente_revision'] },
  { key: 'revisados', label: 'Revisados', statuses: ['revisado'] },
  { key: 'en-proceso', label: 'En proceso', statuses: ['subido', 'procesando'] },
  { key: 'error', label: 'Con error', statuses: ['error'] },
];

/** Cómo se nombra cada grupo dentro de una frase: «conteos por revisar», «conteos con error». */
const GROUP_PHRASES: Readonly<Record<StatusGroupKey, string>> = {
  pendientes: 'por revisar',
  revisados: 'revisados',
  'en-proceso': 'en proceso',
  error: 'con error',
};

export type StatusTally = Readonly<Record<StatusGroupKey, number>>;

const GROUP_BY_STATUS: Readonly<Record<CountStatus, StatusGroupKey>> = {
  subido: 'en-proceso',
  procesando: 'en-proceso',
  pendiente_revision: 'pendientes',
  revisado: 'revisados',
  error: 'error',
};

export function groupOf(status: CountStatus): StatusGroupKey {
  return GROUP_BY_STATUS[status];
}

/** Un valor desconocido en la URL equivale a «todos»: un enlace viejo nunca deja la lista vacía. */
export function parseStatusFilter(value: string | null | undefined): StatusFilter {
  return STATUS_GROUPS.some((group) => group.key === value) ? (value as StatusGroupKey) : 'todos';
}

export function tallyByGroup(counts: readonly CountSummaryView[]): StatusTally {
  const tally: Record<StatusGroupKey, number> = {
    pendientes: 0,
    revisados: 0,
    'en-proceso': 0,
    error: 0,
  };
  for (const count of counts) tally[groupOf(count.status)] += 1;
  return tally;
}

/** Minúsculas, sin tildes ni espacios de más: «la  ceíba» encuentra «La Ceiba». */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function matchesSearch(count: CountSummaryView, query: string): boolean {
  const needle = normalizeSearch(query);
  if (needle === '') return true;
  return (
    normalizeSearch(count.id).includes(needle) || normalizeSearch(count.pastureId).includes(needle)
  );
}

/** Conserva el orden recibido (más reciente primero). */
export function filterCounts(
  counts: readonly CountSummaryView[],
  filter: StatusFilter,
  query: string,
): readonly CountSummaryView[] {
  return counts.filter(
    (count) =>
      (filter === 'todos' || groupOf(count.status) === filter) && matchesSearch(count, query),
  );
}

/**
 * El vuelo revisado más reciente: entre los conteos revisados, el de fecha de vuelo más nueva (no
 * el último en revisarse). Con fechas iguales gana el primero de la lista (el más reciente en cargarse).
 */
export function latestReviewed(counts: readonly CountSummaryView[]): CountSummaryView | undefined {
  let latest: CountSummaryView | undefined;
  for (const count of counts) {
    if (count.status !== 'revisado' || count.reviewedTotal === undefined) continue;
    if (latest === undefined || count.flightDate > latest.flightDate) latest = count;
  }
  return latest;
}

/** Explica por qué la lista quedó vacía, con las mismas palabras del filtro. */
export function describeNoResults(filter: StatusFilter, query: string): string {
  const text = query.trim();
  if (filter === 'todos') return `Ningún potrero ni ID contiene «${text}».`;
  const phrase = GROUP_PHRASES[filter];
  if (text === '') return `No hay conteos ${phrase}.`;
  return `No hay conteos ${phrase} cuyo potrero o ID contenga «${text}».`;
}
