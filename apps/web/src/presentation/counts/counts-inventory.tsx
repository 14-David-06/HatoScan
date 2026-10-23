'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { CloseIcon, SearchIcon } from '../ui/icons';
import type { CountSummaryView } from '../view-models';
import { CountsSummary } from './counts-summary';
import { CountsTable } from './counts-table';
import {
  STATUS_FILTER_PARAM,
  describeNoResults,
  filterCounts,
  latestReviewed,
  parseStatusFilter,
  tallyByGroup,
  type StatusFilter,
} from './filters';
import { StatusLegend } from './status-legend';

/**
 * Resumen, filtros y tabla. El filtro de estado vive en la URL (`?estado=pendientes`) para poder
 * enlazarlo; la búsqueda es local porque cambia con cada tecla.
 */
export function CountsInventory({ counts }: { counts: readonly CountSummaryView[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlFilter = parseStatusFilter(searchParams.get(STATUS_FILTER_PARAM));
  // Next actualiza useSearchParams en una transición; el estado local hace que el radio responda
  // en el mismo clic. Si la URL cambia por otra vía (un enlace a «/»), manda la URL.
  const [filter, setFilter] = useState(urlFilter);
  const [syncedUrlFilter, setSyncedUrlFilter] = useState(urlFilter);
  if (urlFilter !== syncedUrlFilter) {
    setSyncedUrlFilter(urlFilter);
    setFilter(urlFilter);
  }
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const tally = useMemo(() => tallyByGroup(counts), [counts]);
  const latest = useMemo(() => latestReviewed(counts), [counts]);
  const visible = useMemo(() => filterCounts(counts, filter, query), [counts, filter, query]);
  const filtered = filter !== 'todos' || query.trim() !== '';

  function selectFilter(next: StatusFilter) {
    setFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'todos') params.delete(STATUS_FILTER_PARAM);
    else params.set(STATUS_FILTER_PARAM, next);
    const search = params.toString();
    // Filtrar es local: replaceState cambia la URL sin pedir la página al servidor (router.replace
    // volvería a leer todos los conteos en cada flecha del teclado).
    window.history.replaceState(null, '', search ? `${pathname}?${search}` : pathname);
  }

  function clearSearch() {
    setQuery('');
    searchRef.current?.focus();
  }

  function clearFilters() {
    setQuery('');
    if (filter !== 'todos') selectFilter('todos');
  }

  return (
    <>
      <section className="counts-summary" aria-label="Resumen del inventario">
        <CountsSummary total={counts.length} tally={tally} filter={filter} latest={latest} />
        <div className="counts-toolbar">
          <StatusLegend
            total={counts.length}
            tally={tally}
            filter={filter}
            onChange={selectFilter}
          />
          <div className="counts-search">
            <SearchIcon className="counts-search__icon" size={18} />
            <input
              ref={searchRef}
              type="search"
              className="input counts-search__input"
              placeholder="Buscar finca, potrero o ID"
              aria-label="Buscar por finca, potrero o ID"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query !== '' && (
              <button
                type="button"
                className="button button--ghost button--icon counts-search__clear"
                aria-label="Borrar búsqueda"
                onClick={clearSearch}
              >
                <CloseIcon size={16} />
              </button>
            )}
          </div>
        </div>
      </section>

      <p className="visually-hidden" role="status">
        {filtered ? `${visible.length} de ${counts.length} conteos` : ''}
      </p>

      <div className="counts-table-panel">
        {visible.length > 0 ? (
          <CountsTable counts={visible} />
        ) : (
          <div className="counts-no-results">
            <SearchIcon size={22} className="counts-no-results__icon" />
            <p className="counts-no-results__title">Ningún conteo coincide</p>
            <p className="counts-no-results__text">{describeNoResults(filter, query)}</p>
            <button type="button" className="button button--sm" onClick={clearFilters}>
              Quitar filtros
            </button>
          </div>
        )}
      </div>
    </>
  );
}
