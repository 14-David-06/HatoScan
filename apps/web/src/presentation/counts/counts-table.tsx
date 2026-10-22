import Link from 'next/link';
import { formatDate, formatDifference, formatInteger } from '../format';
import { ChevronRightIcon } from '../ui/icons';
import { StatusBadge } from '../ui/status-badge';
import { SPECIES_LABELS, STATUS_LABELS, type CountSummaryView } from '../view-models';
import { CountId } from './count-id';

export function CountsTable({ counts }: { counts: readonly CountSummaryView[] }) {
  return (
    <table className="counts-table">
      <caption className="visually-hidden">Conteos, del más reciente al más antiguo</caption>
      <CountsTableHead />
      <tbody>
        {counts.map((count) => (
          <CountRow key={count.id} count={count} />
        ))}
      </tbody>
    </table>
  );
}

/** Las mismas columnas en la tabla y en su esqueleto: los anchos dependen de estas clases. */
export function CountsTableHead() {
  return (
    <thead>
      <tr>
        <th scope="col" className="counts-cell--id">
          Conteo
        </th>
        <th scope="col" className="counts-cell--pasture">
          Potrero
        </th>
        <th scope="col" className="counts-cell--species">
          Especie
        </th>
        <th scope="col" className="counts-cell--date">
          Fecha de vuelo
        </th>
        <th scope="col" className="counts-cell--status">
          Estado
        </th>
        <th scope="col" className="counts-cell--model">
          Modelo
        </th>
        <th scope="col" className="counts-cell--reviewed">
          Revisado
        </th>
        <th scope="col" className="counts-cell--diff">
          Diferencia
        </th>
      </tr>
    </thead>
  );
}

function CountRow({ count }: { count: CountSummaryView }) {
  const pending = count.status === 'pendiente_revision';
  const difference =
    count.reviewedTotal !== undefined && count.modelTotal !== undefined
      ? count.reviewedTotal - count.modelTotal
      : undefined;

  return (
    <tr className={pending ? 'counts-row counts-row--pending' : 'counts-row'}>
      <td className="counts-cell--id">
        {/*
         * Enlace estirado: toda la fila abre el conteo, pero el foco cae en un solo enlace. Su nombre
         * lleva potrero y estado para que, en una lista de enlaces, no sean doce IDs casi iguales.
         */}
        <Link href={`/conteos/${count.id}`} className="counts-row__link">
          <CountId id={count.id} />
          <span className="visually-hidden">
            , {count.pastureId}, {STATUS_LABELS[count.status]}
          </span>
          <ChevronRightIcon size={18} className="counts-row__chevron" />
        </Link>
      </td>
      <td className="counts-cell--pasture">{count.pastureId}</td>
      <td className="counts-cell--species">{SPECIES_LABELS[count.species]}</td>
      <td className="counts-cell--date">
        <time dateTime={count.flightDate}>{formatDate(count.flightDate)}</time>
      </td>
      <td className="counts-cell--status">
        <StatusBadge status={count.status} />
      </td>
      <td className="counts-cell--model" data-label="Modelo">
        <Total value={count.modelTotal} />
      </td>
      <td className="counts-cell--reviewed" data-label="Revisado">
        <Total value={count.reviewedTotal} />
      </td>
      <td className="counts-cell--diff">
        {difference !== undefined && (
          <span className={difference === 0 ? 'counts-diff counts-diff--zero' : 'counts-diff'}>
            {formatDifference(difference)}
          </span>
        )}
      </td>
    </tr>
  );
}

function Total({ value }: { value: number | undefined }) {
  if (value === undefined) {
    return (
      <>
        <span className="counts-none" aria-hidden="true">
          —
        </span>
        <span className="visually-hidden">sin dato</span>
      </>
    );
  }
  return <>{formatInteger(value)}</>;
}
