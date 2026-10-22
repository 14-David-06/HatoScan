import type { Detection } from '@/domain/index';
import { AutoRefresh } from '../count/auto-refresh';
import { CountHeader } from '../count/count-header';
import { CountPhoto } from '../count/count-photo';
import { RedetectDialog } from '../count/redetect-dialog';
import { reviewKey } from '../count/review-key';
import { DetectPanel } from '../detection/detect-panel';
import { formatDate } from '../format';
import { ReviewEditor } from '../review/review-editor';
import { AlertTriangleIcon } from '../ui/icons';
import {
  STATUS_LABELS,
  type CountDetailView,
  type DetectionMethodsView,
  type SessionUserView,
} from '../view-models';

export function CountScreen({
  count,
  catalog,
  viewer,
}: {
  count: CountDetailView;
  catalog: DetectionMethodsView;
  viewer: SessionUserView;
}) {
  const className = ['page page--wide count', layoutModifier(count)];
  if (count.flight.notes) className.push('count--notes');

  return (
    <main className={className.filter(Boolean).join(' ')}>
      {/* El mismo nodo en todos los estados: cuando el auto-refresco cambia el estado, se anuncia. */}
      <p className="visually-hidden" role="status">
        {`Estado del conteo: ${STATUS_LABELS[count.status]}`}
      </p>
      <CountHeader count={count} />
      <CountBody count={count} catalog={catalog} viewer={viewer} />
    </main>
  );
}

/**
 * Revisión: la página mide exactamente la ventana y el editor se queda con el resto. Foto + panel:
 * al menos la ventana, pero puede crecer si el panel lateral es largo (la foto se queda fija).
 */
function layoutModifier(count: CountDetailView): string {
  return isReviewStatus(count) && count.image && reviewDetections(count)
    ? 'count--fill'
    : 'count--stage';
}

function CountBody({
  count,
  catalog,
  viewer,
}: {
  count: CountDetailView;
  catalog: DetectionMethodsView;
  viewer: SessionUserView;
}) {
  // Un lector ve los estados pero no ejecuta detecciones ni confirma.
  const detectPanel = (mode: 'first' | 'retry' | 'again') =>
    viewer.canReview ? (
      <DetectPanel countId={count.id} catalog={catalog} mode={mode} />
    ) : (
      <p className="count-side__text">Tu rol es lector: un revisor ejecuta la detección.</p>
    );
  const photo = (scanning = false) => (
    <CountPhoto
      src={count.imageUrl}
      alt={`Foto aérea de ${count.pastureId}, vuelo del ${formatDate(count.flightDate, 'long')}`}
      size={count.image}
      scanning={scanning}
    />
  );

  switch (count.status) {
    case 'subido':
      return (
        <div className="count-stage">
          {photo()}
          <section className="panel count-side" aria-labelledby="count-side-title">
            <h2 id="count-side-title" className="count-side__title">
              Listo para detectar
            </h2>
            <p className="count-side__text">
              La foto está cargada. Elige el método de detección: sus marcas son una propuesta que
              revisas antes de confirmar el conteo.
            </p>
            {detectPanel('first')}
          </section>
        </div>
      );
    case 'procesando':
      return (
        <div className="count-stage">
          {photo(true)}
          <section className="panel count-side" aria-labelledby="count-side-title">
            <h2 id="count-side-title" className="count-side__title">
              El detector está analizando la foto
            </h2>
            <p className="count-side__text">
              Cuando termine, verás sus marcas sobre la foto para revisarlas una por una.
            </p>
            <AutoRefresh />
          </section>
        </div>
      );
    case 'error':
      return (
        <div className="count-stage count-stage--error">
          {photo()}
          <section className="panel count-side" aria-labelledby="count-side-title">
            <div className="callout callout--danger">
              <AlertTriangleIcon size={18} />
              <div className="count-callout">
                <h2 id="count-side-title" className="count-callout__title">
                  La detección falló
                </h2>
                <p>
                  El conteo no se corrige solo. Revisa el detalle y reintenta con el mismo método o
                  con otro.
                </p>
              </div>
            </div>
            {count.errorMessage && (
              <div className="count-error">
                <p className="count-error__label">Detalle del error</p>
                <pre className="count-error__detail">{count.errorMessage}</pre>
              </div>
            )}
            {detectPanel('retry')}
          </section>
        </div>
      );
    case 'pendiente_revision':
    case 'revisado': {
      const detections = reviewDetections(count);
      if (!count.image || !detections) {
        const reviewed = count.status === 'revisado';
        return (
          <div className="count-stage count-stage--error">
            {photo()}
            <section className="panel count-side" aria-labelledby="count-side-title">
              <div className="callout callout--danger">
                <AlertTriangleIcon size={18} />
                <div className="count-callout">
                  <h2 id="count-side-title" className="count-callout__title">
                    No se encontraron las detecciones de este conteo
                  </h2>
                  {reviewed ? (
                    <p>
                      Hay una revisión confirmada, pero no se pudo leer el archivo de sus
                      detecciones. Recarga la página; si sigue igual, avisa al equipo técnico con el
                      ID del conteo.
                    </p>
                  ) : (
                    <p>
                      El registro dice que hay una propuesta del modelo, pero no se pudo leer su
                      archivo. Vuelve a detectar; si el fallo sigue, avisa al equipo técnico con el
                      ID del conteo.
                    </p>
                  )}
                </div>
              </div>
              {!reviewed && detectPanel('again')}
            </section>
          </div>
        );
      }
      return (
        <div className="count-workspace">
          <ReviewEditor
            // Cambia con la propuesta, no solo con el estado: volver a detectar monta un editor nuevo.
            key={reviewKey({
              status: count.status,
              detectorVersion: count.detectorVersion,
              detections,
            })}
            countId={count.id}
            imageUrl={count.imageUrl}
            image={count.image}
            detections={detections}
            readOnly={count.status === 'revisado'}
            reviewer={viewer.canReview ? { id: viewer.id, name: viewer.name } : null}
            extraTools={
              count.status === 'pendiente_revision' &&
              viewer.canReview && <RedetectDialog countId={count.id} catalog={catalog} />
            }
          />
        </div>
      );
    }
  }
}

function isReviewStatus(count: CountDetailView): boolean {
  return count.status === 'pendiente_revision' || count.status === 'revisado';
}

/** Revisado → lo que confirmó la persona; pendiente → la propuesta del modelo. */
function reviewDetections(count: CountDetailView): readonly Detection[] | undefined {
  return count.status === 'revisado' ? count.reviewedDetections : count.modelDetections;
}
