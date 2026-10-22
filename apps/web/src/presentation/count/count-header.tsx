import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDate, formatDifference, formatInteger } from '../format';
import { ShieldCheckIcon } from '../ui/icons';
import { StatusBadge } from '../ui/status-badge';
import { SPECIES_LABELS, type CountDetailView } from '../view-models';
import { bogotaDay } from './bogota-day';

/**
 * Cabecera compacta del conteo: el espacio vertical es para la foto. Dos grupos de hechos: lo que se
 * voló (potrero, fecha, altura…) y lo que se contó (detector, totales, revisión). Sin iconos en las
 * etiquetas salvo el escudo del total revisado, que es el dato oficial.
 */
export function CountHeader({ count }: { count: CountDetailView }) {
  const { flight } = count;
  const reviewed = count.reviewedTotal !== undefined;
  const hasResult =
    count.detectorVersion !== undefined || count.modelTotal !== undefined || reviewed;

  return (
    <header className="count-header">
      <nav aria-label="Ruta de navegación">
        <ol className="breadcrumb">
          <li>
            <Link href="/conteos">Conteos</Link>
          </li>
          <li>
            <span aria-current="page" className="count-header__crumb">
              {count.id}
            </span>
          </li>
        </ol>
      </nav>

      <div className="count-header__title">
        <h1 className="count-header__id">{count.id}</h1>
        <StatusBadge status={count.status} size="lg" />
      </div>

      <div className="count-header__facts">
        <dl className="facts count-facts">
          <Fact label="Potrero">{count.pastureId}</Fact>
          <Fact label="Especie">{SPECIES_LABELS[count.species]}</Fact>
          <Fact label="Fecha de vuelo">{formatDate(count.flightDate)}</Fact>
          {flight.altitudeM !== undefined && (
            <Fact label="Altura">{formatDecimal(flight.altitudeM)} m</Fact>
          )}
          {flight.cameraAngleDeg !== undefined && (
            <Fact label="Ángulo de cámara">{formatDecimal(flight.cameraAngleDeg)}°</Fact>
          )}
        </dl>

        {hasResult && (
          <dl className="facts count-facts count-facts--result">
            {count.detectorVersion && (
              <Fact label="Detector" className="count-fact--wide">
                <span className="tag">{count.detectorVersion}</span>
              </Fact>
            )}
            {count.modelTotal !== undefined && (
              <Fact label="Total modelo">{formatInteger(count.modelTotal)}</Fact>
            )}
            {count.reviewedTotal !== undefined && (
              <>
                <Fact
                  label="Total revisado"
                  icon={<ShieldCheckIcon size={13} />}
                  className="count-fact--official"
                >
                  {formatInteger(count.reviewedTotal)}
                </Fact>
                <Fact label="Diferencia">
                  {formatDifference(count.reviewedTotal - (count.modelTotal ?? 0))}
                </Fact>
              </>
            )}
            {count.reviewerId && (
              <Fact label="Revisor">
                <span className="count-fact__id">{count.reviewerId}</span>
              </Fact>
            )}
            {count.reviewedAt && (
              <Fact label="Fecha de revisión">{formatDate(bogotaDay(count.reviewedAt))}</Fact>
            )}
          </dl>
        )}
      </div>

      {flight.notes && (
        <p className="count-header__notes">
          <span className="count-header__notes-label">Observaciones de vuelo</span>
          <span className="count-header__notes-text">{flight.notes}</span>
        </p>
      )}
    </header>
  );
}

function Fact({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ? `count-fact ${className}` : 'count-fact'}>
      <dt>
        {icon}
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/** `80` → `80`, `80.5` → `80,5`: altura y ángulo pueden venir con decimales. */
function formatDecimal(value: number): string {
  return Number.isInteger(value) ? formatInteger(value) : value.toFixed(1).replace('.', ',');
}
