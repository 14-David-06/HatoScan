import { formatInteger } from '../format';
import { STATUS_GROUPS, type StatusFilter, type StatusTally } from './filters';

const OPTIONS: readonly { key: StatusFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  ...STATUS_GROUPS.map(({ key, label }) => ({ key, label })),
];

/**
 * Leyenda de la barra y filtro a la vez: cada opción lleva el color de su segmento y el número de
 * conteos. Radios nativos: las flechas del teclado recorren las opciones.
 */
export function StatusLegend({
  total,
  tally,
  filter,
  onChange,
}: {
  total: number;
  tally: StatusTally;
  filter: StatusFilter;
  onChange: (next: StatusFilter) => void;
}) {
  return (
    <fieldset className="counts-legend">
      <legend className="visually-hidden">Filtrar por estado</legend>
      {OPTIONS.map(({ key, label }) => {
        const amount = key === 'todos' ? total : tally[key];
        const checked = filter === key;
        return (
          <label key={key} className="counts-legend__option">
            <input
              type="radio"
              name="counts-estado"
              value={key}
              checked={checked}
              disabled={amount === 0 && !checked}
              onChange={() => onChange(key)}
            />
            {key !== 'todos' && (
              <span className={`counts-legend__swatch counts-tone--${key}`} aria-hidden="true" />
            )}
            <span>{label}</span>
            <span className="counts-legend__count">{formatInteger(amount)}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
