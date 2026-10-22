import Link from 'next/link';
import { formatDate, formatInteger } from '../format';
import type { CountSummaryView } from '../view-models';
import { STATUS_GROUPS, type StatusFilter, type StatusTally } from './filters';

/**
 * «¿Cómo va el inventario?»: cuántos conteos esperan a una persona, el vuelo revisado más reciente
 * y la distribución por estado. No suma animales entre conteos: el mismo potrero volado dos veces
 * contaría dos veces a los mismos animales.
 */
export function CountsSummary({
  total,
  tally,
  filter,
  latest,
}: {
  total: number;
  tally: StatusTally;
  filter: StatusFilter;
  latest: CountSummaryView | undefined;
}) {
  const pending = tally.pendientes;

  return (
    <>
      <div className="counts-summary__top">
        <p className="counts-summary__headline">
          {pending > 0 ? (
            <>
              <span className="counts-summary__figure">{formatInteger(pending)}</span>
              <span className="counts-summary__phrase">
                de {formatInteger(total)} {total === 1 ? 'conteo' : 'conteos'}{' '}
                {pending === 1 ? 'espera' : 'esperan'} revisión
              </span>
            </>
          ) : (
            <span className="counts-summary__phrase">Ningún conteo espera revisión</span>
          )}
        </p>

        {latest && latest.reviewedTotal !== undefined && (
          <LatestReviewed count={latest} reviewedTotal={latest.reviewedTotal} />
        )}
      </div>

      <StatusBar tally={tally} filter={filter} />
    </>
  );
}

/**
 * Los tres hechos van bajo un mismo título: el total es el de ese vuelo, no el del hato. Es el
 * vuelo más reciente entre los revisados, no la última revisión hecha.
 */
function LatestReviewed({
  count,
  reviewedTotal,
}: {
  count: CountSummaryView;
  reviewedTotal: number;
}) {
  return (
    <div className="counts-latest" role="group" aria-labelledby="counts-latest-title">
      <p id="counts-latest-title" className="counts-latest__title">
        Vuelo revisado más reciente
      </p>
      <dl className="facts">
        <div>
          <dt>Potrero</dt>
          <dd>
            <Link href={`/conteos/${count.id}`} className="counts-latest__link">
              {count.pastureId}
            </Link>
          </dd>
        </div>
        <div>
          <dt>Total revisado</dt>
          <dd>{formatInteger(reviewedTotal)}</dd>
        </div>
        <div>
          <dt>Fecha de vuelo</dt>
          <dd>
            <time dateTime={count.flightDate}>{formatDate(count.flightDate)}</time>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Barra apilada de la distribución por estado. Es decorativa para lectores de pantalla: la leyenda
 * (que también filtra) dice lo mismo con texto. Al filtrar, se atenúan los segmentos que no
 * corresponden al filtro.
 */
function StatusBar({ tally, filter }: { tally: StatusTally; filter: StatusFilter }) {
  const groups = STATUS_GROUPS.filter((group) => tally[group.key] > 0);
  if (groups.length === 0) return null;

  return (
    <div className="counts-bar" aria-hidden="true">
      {groups.map((group) => (
        <span
          key={group.key}
          className={`counts-bar__segment counts-tone--${group.key}`}
          data-dimmed={filter !== 'todos' && filter !== group.key ? '' : undefined}
          title={`${group.label}: ${formatInteger(tally[group.key])}`}
          style={{ flexGrow: tally[group.key] }}
        />
      ))}
    </div>
  );
}
