import { CountsHeader } from './counts-header';
import { CountsTableHead } from './counts-table';

type BarSize =
  | 'figure'
  | 'phrase'
  | 'title'
  | 'label'
  | 'value'
  | 'id'
  | 'pasture-sm'
  | 'pasture-md'
  | 'pasture-lg'
  | 'species'
  | 'date'
  | 'status'
  | 'num';

/** Largo del potrero en cada fila: si todas las barras miden igual, parece una rejilla y no una lista. */
const ROWS: readonly BarSize[] = [
  'pasture-md',
  'pasture-sm',
  'pasture-lg',
  'pasture-sm',
  'pasture-md',
  'pasture-lg',
  'pasture-sm',
];

/**
 * Esqueleto de la lista mientras llegan los conteos (app/loading.tsx). Usa la misma cabecera, las
 * mismas clases del resumen y la misma tabla que la página, con barras en lugar de datos: los
 * anchos de columna y los cambios por ancho de pantalla coinciden por construcción.
 */
export function CountsSkeleton() {
  return (
    <main className="page" aria-busy="true">
      <p className="visually-hidden" role="status">
        Cargando conteos
      </p>
      <CountsHeader />

      <div className="counts-summary" aria-hidden="true">
        <div className="counts-summary__top">
          <p className="counts-summary__headline">
            <span className="counts-summary__figure">
              <Bar size="figure" />
            </span>
            <span className="counts-summary__phrase">
              <Bar size="phrase" />
            </span>
          </p>
          <div className="counts-latest">
            <p className="counts-latest__title">
              <Bar size="title" />
            </p>
            <dl className="facts">
              {[0, 1, 2].map((index) => (
                <div key={index}>
                  <dt>
                    <Bar size="label" />
                  </dt>
                  <dd>
                    <Bar size="value" />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <span className="skeleton counts-skeleton__bar" />
        <div className="counts-toolbar">
          <span className="skeleton counts-skeleton__legend" />
          <div className="counts-search">
            <span className="skeleton counts-skeleton__search" />
          </div>
        </div>
      </div>

      <div className="counts-table-panel" aria-hidden="true">
        <table className="counts-table">
          <CountsTableHead />
          <tbody>
            {ROWS.map((pasture, index) => (
              <tr key={index} className="counts-row">
                <td className="counts-cell--id">
                  <Bar size="id" />
                </td>
                <td className="counts-cell--pasture">
                  <Bar size={pasture} />
                </td>
                <td className="counts-cell--species">
                  <Bar size="species" />
                </td>
                <td className="counts-cell--date">
                  <Bar size="date" />
                </td>
                <td className="counts-cell--status">
                  <Bar size="status" />
                </td>
                <td className="counts-cell--model" data-label="Modelo">
                  <Bar size="num" />
                </td>
                <td className="counts-cell--reviewed" data-label="Revisado">
                  <Bar size="num" />
                </td>
                <td className="counts-cell--diff">
                  <Bar size="num" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

/** Barra en línea: hereda el alto de línea del texto que sustituye. */
function Bar({ size }: { size: BarSize }) {
  return <span className={`skeleton counts-skeleton__text counts-skeleton__text--${size}`} />;
}
