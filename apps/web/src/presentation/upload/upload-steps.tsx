import type { CSSProperties, ReactNode } from 'react';
import { formatBytes } from '../format';
import { formatElapsed } from '../detection/elapsed';
import { CheckIcon, ClockIcon } from '../ui/icons';
import type { TransferProgress } from './post-form';

export type UploadStep = 'upload' | 'detect' | 'review';

const ORDER: readonly UploadStep[] = ['upload', 'detect', 'review'];

interface UploadStepsProps {
  readonly active: UploadStep;
  /** Bytes enviados de la subida en curso; `null` antes del primer aviso del navegador. */
  readonly upload: TransferProgress | null;
  /** Nombre del método elegido; `null` si se usa el predeterminado. */
  readonly method: string | null;
  /** Tiempo que lleva (o llevó) la detección. */
  readonly detectMs: number;
}

/** Los tres pasos reales de un conteo nuevo: subir la foto, detectar y abrir la revisión. */
export function UploadSteps({ active, upload, method, detectMs }: UploadStepsProps) {
  const current = ORDER.indexOf(active);
  const stateOf = (step: UploadStep) => {
    const index = ORDER.indexOf(step);
    return index < current ? 'done' : index === current ? 'active' : 'pending';
  };

  const fraction = upload && upload.total > 0 ? Math.min(1, upload.loaded / upload.total) : 0;
  const percent = Math.floor(fraction * 100);
  const sent = upload !== null && upload.total > 0 && upload.loaded >= upload.total;

  return (
    <div className="upload-steps">
      <ol className="upload-steps__list" aria-label="Progreso del conteo">
        <Step index={1} state={stateOf('upload')} title="Subir foto">
          {stateOf('upload') === 'done' ? (
            <span>{upload ? `${formatBytes(upload.total)} enviados` : 'Foto enviada'}</span>
          ) : sent ? (
            <span>Foto recibida; registrando el conteo…</span>
          ) : (
            <span>
              <strong className="upload-steps__figure">{percent} %</strong>
              {upload && (
                <span className="upload-steps__muted">
                  {formatBytes(upload.loaded)} de {formatBytes(upload.total)}
                </span>
              )}
            </span>
          )}
          {stateOf('upload') === 'active' && (
            <div
              className={sent ? 'progress progress--indeterminate' : 'progress'}
              role="progressbar"
              aria-label="Subida de la foto"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={sent ? undefined : percent}
            >
              <div className="progress__bar" style={{ '--progress': fraction } as CSSProperties} />
            </div>
          )}
        </Step>

        <Step index={2} state={stateOf('detect')} title="Detectar animales">
          {stateOf('detect') === 'pending' ? (
            <span className="upload-steps__muted">{method ?? 'Método predeterminado'}</span>
          ) : (
            <span>
              <span className="upload-steps__method">{method ?? 'Método predeterminado'}</span>
              <span className="upload-steps__clock">
                <ClockIcon size={12} />
                {formatElapsed(detectMs)}
              </span>
            </span>
          )}
          {stateOf('detect') === 'active' && (
            <div
              className="progress progress--indeterminate upload-steps__model"
              role="progressbar"
              aria-label="Detección de animales"
            >
              <div className="progress__bar" />
            </div>
          )}
        </Step>

        <Step index={3} state={stateOf('review')} title="Revisar">
          <span className={stateOf('review') === 'active' ? undefined : 'upload-steps__muted'}>
            {stateOf('review') === 'active' ? 'Abriendo la revisión…' : 'Confirmas las marcas'}
          </span>
        </Step>
      </ol>
      {active === 'detect' && (
        <p className="upload-steps__note">
          Según el método, la detección puede tardar unos minutos. Mantén esta página abierta.
        </p>
      )}
    </div>
  );
}

function Step({
  index,
  state,
  title,
  children,
}: {
  index: number;
  state: 'done' | 'active' | 'pending';
  title: string;
  children: ReactNode;
}) {
  return (
    <li
      className="upload-steps__step"
      data-state={state}
      aria-current={state === 'active' ? 'step' : undefined}
    >
      <span className="upload-steps__marker" aria-hidden="true">
        {state === 'done' ? <CheckIcon size={14} /> : index}
      </span>
      <div className="upload-steps__body">
        <span className="upload-steps__title">
          {title}
          {state === 'done' && <span className="visually-hidden"> (hecho)</span>}
        </span>
        <div className="upload-steps__detail">{children}</div>
      </div>
    </li>
  );
}
