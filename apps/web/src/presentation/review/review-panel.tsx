'use client';

import { memo, useId, type CSSProperties, type ReactNode } from 'react';
import type { ReviewerView } from '../view-models';
import { formatInteger } from '../format';
import { AlertTriangleIcon, CheckIcon, ChevronDownIcon, InfoIcon } from '../ui/icons';
import { formatAnimals } from './review-format';
import type { PhotoState } from './review-hud';
import type { ReviewSummary } from './review-state';
import { RollingNumber } from './rolling-number';

interface ReviewPanelProps {
  readonly readOnly: boolean;
  /** Sin la foto cargada no se puede confirmar. */
  readonly photo: PhotoState;
  readonly summary: ReviewSummary;
  readonly dirty: boolean;
  /** El conteo ya está revisado (distinto de solo lectura por rol). */
  readonly reviewed: boolean;
  readonly reviewer: ReviewerView | null;
  readonly submitError: string | null;
  readonly submitting: boolean;
  readonly onSubmit: () => void;
  readonly extraTools?: ReactNode;
}

/**
 * Panel lateral del editor: el total que se va a confirmar, de qué se compone, cómo revisar y la
 * confirmación. Memoizado: mover o acercar la foto no lo vuelve a renderizar.
 */
export const ReviewPanel = memo(function ReviewPanel({
  readOnly,
  photo,
  summary,
  dirty,
  reviewed,
  reviewer,
  submitError,
  submitting,
  onSubmit,
  extraTools,
}: ReviewPanelProps) {
  const submitNoteId = `${useId()}-submit-note`;
  const canSubmit = photo === 'ready';

  return (
    <aside className="review-panel" aria-label="Resumen de la revisión">
      {/* El cuerpo se desplaza; el pie con la confirmación queda siempre a la vista. */}
      <div className="review-panel__body">
        <div className="review-panel__main">
          <section className="review-total">
            <div className="review-total__head">
              <h2 className="review-total__label">
                {reviewed
                  ? 'Total revisado'
                  : readOnly
                    ? 'Propuesta del modelo'
                    : 'Total a confirmar'}
              </h2>
              {!readOnly && (
                <p className="review-dirty" data-visible={dirty || undefined}>
                  <span className="review-dirty__dot" aria-hidden="true" />
                  Cambios sin guardar
                </p>
              )}
            </div>
            <RollingNumber
              value={summary.total}
              className={`review-total__value${reviewed ? ' review-total__value--official' : ''}${summary.total >= 1000 ? ' review-total__value--long' : ''}`}
            />
            <p className="visually-hidden" aria-live="polite" aria-atomic="true">
              {formatAnimals(summary.total)}
            </p>
          </section>

          {!readOnly && summary.model === 0 && (
            <p className="callout callout--signal review-empty">
              <InfoIcon size={18} />
              <span>
                El detector no propuso animales. <Gesture mouse="Haz clic sobre" touch="Toca" />{' '}
                cada animal para añadirlo.
              </span>
            </p>
          )}

          <Composition summary={summary} readOnly={readOnly} />
        </div>

        <div className="review-panel__more">
          <HowTo readOnly={readOnly} />
          {extraTools && <div className="review-panel__extra">{extraTools}</div>}
        </div>
      </div>

      {readOnly && !reviewed && (
        <div className="review-panel__footer">
          <p className="review-confirm__note">
            Tu rol es lector: puedes ver la propuesta, pero no confirmar el conteo.
          </p>
        </div>
      )}

      {!readOnly && (
        <div className="review-panel__footer">
          {reviewer && (
            <p className="review-reviewer">
              Confirmas como <strong>{reviewer.name}</strong>{' '}
              <span className="review-nowrap">({reviewer.id})</span>
            </p>
          )}

          {submitError && (
            <p className="callout callout--danger review-submit-error" role="alert">
              <AlertTriangleIcon size={18} />
              <span>{submitError}</span>
            </p>
          )}

          <div className="review-confirm">
            <button
              type="button"
              className="button button--primary button--lg button--block review-submit"
              onClick={onSubmit}
              aria-busy={submitting || undefined}
              aria-disabled={canSubmit ? undefined : true}
              aria-describedby={canSubmit ? undefined : submitNoteId}
            >
              {submitting ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <CheckIcon size={20} />
              )}
              Confirmar conteo
              <span className="review-submit__count">{formatInteger(summary.total)}</span>
            </button>
            {/*
              La carga ya se ve en el visor y dura poco: aquí su aviso es solo para lectores de
              pantalla, así el pie no salta al terminar. El fallo sí se queda a la vista.
            */}
            {!canSubmit && (
              <p
                id={submitNoteId}
                className={
                  photo === 'error'
                    ? 'review-confirm__note'
                    : 'review-confirm__note visually-hidden'
                }
              >
                {photo === 'error'
                  ? 'La foto no cargó: recarga la página para revisarla.'
                  : 'Espera a que cargue la foto para confirmar.'}
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
});

/** El verbo del gesto según el puntero: «clic» con ratón, «toca» en pantallas táctiles. */
function Gesture({ mouse, touch }: { mouse: string; touch: string }) {
  return (
    <>
      <span className="review-on-mouse">{mouse}</span>
      <span className="review-on-touch">{touch}</span>
    </>
  );
}

/**
 * Barra apilada y desglose. El orden de la barra es el de las filas: confirmadas y añadidas suman
 * el total; las descartadas quedan fuera, rayadas.
 */
function Composition({ summary, readOnly }: { summary: ReviewSummary; readOnly: boolean }) {
  const all = summary.confirmed + summary.added + summary.discarded;
  const share = (n: number) => (all > 0 ? n / all : 0);
  const style = {
    '--compo-confirmed': share(summary.confirmed),
    '--compo-added': share(summary.confirmed + summary.added),
    '--compo-all': all > 0 ? 1 : 0,
  } as CSSProperties;

  return (
    <div className="review-compo">
      <div className="review-compo__bar" style={style} aria-hidden="true">
        <span className="review-compo__seg review-compo__seg--discarded" />
        <span className="review-compo__seg review-compo__seg--added" />
        <span className="review-compo__seg review-compo__seg--confirmed" />
      </div>
      <dl className="review-compo__rows">
        <div className="review-compo__row">
          <dt>
            <span className="review-swatch review-swatch--confirmed" aria-hidden="true" />
            Confirmadas
          </dt>
          <dd>{formatInteger(summary.confirmed)}</dd>
        </div>
        <div className="review-compo__row">
          <dt>
            <span className="review-swatch review-swatch--added" aria-hidden="true" />
            {readOnly ? 'Añadidas por el revisor' : 'Añadidas por ti'}
          </dt>
          <dd>{formatInteger(summary.added)}</dd>
        </div>
        <div className="review-compo__row">
          <dt>
            <span className="review-swatch review-swatch--discarded" aria-hidden="true" />
            Descartadas
          </dt>
          <dd>{formatInteger(summary.discarded)}</dd>
        </div>
        <div className="review-compo__row review-compo__row--model">
          <dt>Propuestas del modelo</dt>
          <dd>{formatInteger(summary.model)}</dd>
        </div>
      </dl>
    </div>
  );
}

function HowTo({ readOnly }: { readOnly: boolean }) {
  return (
    <details className="review-help" open>
      <summary className="review-help__summary">
        {readOnly ? 'Cómo moverte por la foto' : 'Cómo revisar'}
        <ChevronDownIcon className="review-help__chevron" />
      </summary>
      {!readOnly && (
        <ul className="review-help__rules">
          <li>
            <HelpGlyph variant="add" />
            <span>
              <Gesture mouse="Clic en" touch="Toca" /> un animal sin marca:{' '}
              <strong>lo añade</strong>.
            </span>
          </li>
          <li>
            <HelpGlyph variant="toggle" />
            <span>
              <Gesture mouse="Clic en" touch="Toca" /> una marca del modelo:{' '}
              <strong>la descarta o la restaura</strong>.
            </span>
          </li>
          <li>
            <HelpGlyph variant="remove" />
            <span>
              <Gesture mouse="Clic en" touch="Toca" /> una marca tuya: <strong>la quita</strong>.
            </span>
          </li>
        </ul>
      )}
      <dl className="review-help__keys">
        <div>
          <dt>
            <Gesture mouse="Arrastrar o flechas" touch="Arrastrar" />
          </dt>
          <dd>Mover la vista</dd>
        </div>
        <div>
          <dt>
            <span className="review-on-mouse">Rueda</span>
            <kbd className="kbd review-on-mouse">+</kbd>
            <kbd className="kbd review-on-mouse">−</kbd>
            <span className="review-on-touch">Pellizcar</span>
          </dt>
          <dd>Acercar o alejar</dd>
        </div>
        {/* Los atajos de una tecla no aplican en pantallas táctiles: allí está la barra del visor. */}
        <div className="review-on-mouse">
          <dt>
            <kbd className="kbd">F</kbd>
          </dt>
          <dd>Ajustar a la vista</dd>
        </div>
        <div className="review-on-mouse">
          <dt>
            <kbd className="kbd">H</kbd>
          </dt>
          <dd>Ocultar o mostrar marcas</dd>
        </div>
        {!readOnly && (
          <div className="review-on-mouse">
            <dt>
              <kbd className="kbd">Ctrl</kbd>
              <kbd className="kbd">Z</kbd>
            </dt>
            <dd>Deshacer</dd>
          </div>
        )}
      </dl>
    </details>
  );
}

/** Icono de cada regla de clic, dibujado como las marcas sobre una pastilla oscura del visor. */
function HelpGlyph({ variant }: { variant: 'add' | 'toggle' | 'remove' }) {
  return (
    <svg
      className={`review-help-glyph review-help-glyph--${variant}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {variant === 'toggle' ? (
        <>
          <path className="review-help-glyph__model" d="M12 5.5a6.5 6.5 0 0 0 0 13" />
          <path
            className="review-help-glyph__discarded"
            d="M12 5.5a6.5 6.5 0 0 1 0 13"
            pathLength={12}
          />
        </>
      ) : (
        <>
          <circle className="review-help-glyph__human" cx="12" cy="12" r="6.5" />
          <path
            className="review-help-glyph__sign"
            d={variant === 'add' ? 'M12 9.25v5.5M9.25 12h5.5' : 'M9.25 12h5.5'}
          />
        </>
      )}
    </svg>
  );
}
