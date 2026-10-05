import Link from 'next/link';
import { ReviewEditor } from '../review/review-editor';
import { SPECIES_LABELS, STATUS_LABELS, type CountDetailView } from '../view-models';
import { ProcessButton } from './process-button';

export function CountScreen({ count }: { count: CountDetailView }) {
  return (
    <main className="page page--wide">
      <header className="count-header">
        <div>
          <p className="count-header__back">
            <Link href="/">← Conteos</Link>
          </p>
          <h1>
            {count.id}{' '}
            <span className={`status status--${count.status}`}>{STATUS_LABELS[count.status]}</span>
          </h1>
          <p className="muted">
            {count.pastureId} · {SPECIES_LABELS[count.species]} · vuelo {count.flightDate}
            {count.flight.altitudeM !== undefined && ` · ${count.flight.altitudeM} m`}
            {count.flight.cameraAngleDeg !== undefined && ` · ${count.flight.cameraAngleDeg}°`}
          </p>
        </div>
        <dl className="count-header__facts">
          {count.detectorVersion && (
            <div>
              <dt>Detector</dt>
              <dd>
                <code>{count.detectorVersion}</code>
              </dd>
            </div>
          )}
          {count.modelTotal !== undefined && (
            <div>
              <dt>Total modelo</dt>
              <dd>{count.modelTotal}</dd>
            </div>
          )}
          {count.reviewedTotal !== undefined && (
            <>
              <div>
                <dt>Total revisado</dt>
                <dd>
                  <strong>{count.reviewedTotal}</strong>
                </dd>
              </div>
              <div>
                <dt>Diferencia</dt>
                <dd>{formatDifference(count.reviewedTotal - (count.modelTotal ?? 0))}</dd>
              </div>
              <div>
                <dt>Revisor</dt>
                <dd>
                  {count.reviewerId}
                  {count.reviewedAt && ` · ${count.reviewedAt.slice(0, 10)}`}
                </dd>
              </div>
            </>
          )}
        </dl>
      </header>

      <CountBody count={count} />
    </main>
  );
}

function CountBody({ count }: { count: CountDetailView }) {
  switch (count.status) {
    case 'subido':
      return (
        <section className="panel">
          <p>La foto está cargada. Ejecuta el detector para obtener la propuesta de conteo.</p>
          <ProcessButton countId={count.id} />
        </section>
      );
    case 'procesando':
      return (
        <section className="panel">
          <p>El detector está procesando la imagen. Recarga la página en unos segundos.</p>
        </section>
      );
    case 'error':
      return (
        <section className="panel panel--error">
          <p>
            <strong>La detección falló.</strong> El conteo no se corrigió automáticamente; revisa el
            error y vuelve a subir la foto si hace falta.
          </p>
          <pre className="error-detail">{count.errorMessage}</pre>
        </section>
      );
    case 'pendiente_revision':
    case 'revisado': {
      const detections =
        count.status === 'revisado' ? count.reviewedDetections : count.modelDetections;
      if (!count.image || !detections) {
        return (
          <section className="panel panel--error">
            <p>No se encontraron las detecciones de este conteo.</p>
          </section>
        );
      }
      return (
        <ReviewEditor
          key={count.status}
          countId={count.id}
          imageUrl={count.imageUrl}
          image={count.image}
          detections={detections}
          readOnly={count.status === 'revisado'}
        />
      );
    }
  }
}

function formatDifference(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
