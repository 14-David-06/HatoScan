'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { SPECIES, type Species } from '@/domain/index';
import { useElapsedSince } from '../detection/elapsed';
import { MethodSelect, methodLabel, useMethod } from '../detection/method-select';
import { AlertTriangleIcon, ChevronDownIcon, UploadIcon } from '../ui/icons';
import { PhotoDropzone } from '../upload/photo-dropzone';
import { imageTypeOf } from '../upload/photo-file';
import {
  postJson,
  readReply,
  readUploadTarget,
  uploadWithProgress,
  type JsonReply,
  type TransferProgress,
} from '../upload/post-form';
import { UploadSteps, type UploadStep } from '../upload/upload-steps';
import { SPECIES_LABELS, type DetectionMethodsView } from '../view-models';

type Phase = 'idle' | 'uploading' | 'detecting' | 'opening';

const STEP_OF: Readonly<Record<Exclude<Phase, 'idle'>, UploadStep>> = {
  uploading: 'upload',
  detecting: 'detect',
  opening: 'review',
};

const ANNOUNCEMENTS: Readonly<Record<Phase, string>> = {
  idle: '',
  uploading: 'Subiendo la foto.',
  detecting: 'Foto subida. Detectando animales.',
  opening: 'Detección terminada. Abriendo la revisión.',
};

const DEFAULT_SPECIES: Species = 'bufala';

/** Fincas a la vista como etiquetas; el resto aparece al escribir (datalist). */
const FARM_CHIPS = 6;

export function NewCountScreen({
  today,
  catalog,
  farms,
}: {
  today: string;
  catalog: DetectionMethodsView;
  /** Fincas de conteos anteriores, la más reciente primero. */
  farms: readonly string[];
}) {
  const router = useRouter();
  const [farm, setFarm] = useState('');
  const farmId = useId();
  const [method, setMethod] = useMethod(catalog);
  // El radio del método no es un campo del conteo: se quita del FormData antes de enviarlo.
  const methodField = useId();
  const [phase, setPhase] = useState<Phase>('idle');
  const [upload, setUpload] = useState<TransferProgress | null>(null);
  const [detectStartedAt, setDetectStartedAt] = useState<number | null>(null);
  const [detectMs, setDetectMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const elapsed = useElapsedSince(detectStartedAt);
  const busy = phase !== 'idle';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Cerrar o recargar la pestaña a mitad de la subida o de la detección deja el conteo a medias.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  // En móvil el error, bajo la foto, puede quedar lejos del botón: si no se ve, se trae junto al
  // visor. Siempre se enfoca, para que el teclado siga desde ahí.
  useEffect(() => {
    const callout = errorRef.current;
    if (!error || !callout) return;
    const { top, bottom } = callout.getBoundingClientRect();
    // `scroll-margin-top` ya descuenta la barra superior fija.
    const covered = parseFloat(getComputedStyle(callout).scrollMarginTop) || 0;
    if (top < covered || bottom > window.innerHeight) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      callout.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
    callout.focus({ preventScroll: true });
  }, [error]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const form = new FormData(event.currentTarget);
    form.delete(methodField);

    setUpload(null);
    setPhase('uploading');
    revealProgress(photoRef.current);

    let id: string;
    try {
      const image = form.get('image');
      form.delete('image');
      const type = image instanceof File ? imageTypeOf(image) : null;
      if (!(image instanceof File) || image.size === 0 || type === null) {
        throw new Error('Adjunta la foto aérea original (JPG, PNG o TIFF).');
      }

      // 1. URL firmada; 2. la foto va directo al almacenamiento; 3. se registra el conteo.
      const prepared = await postJson('/api/counts/uploads', {
        contentType: type,
        size: image.size,
      });
      const target = readUploadTarget(prepared.body);
      if (!prepared.ok || !target) throw new Error(serverError(prepared));

      const uploaded = await uploadWithProgress(target, image, setUpload);
      if (!uploaded.ok) {
        throw new Error(
          `El almacenamiento rechazó la foto (error ${uploaded.status}). Vuelve a intentarlo.`,
        );
      }

      const fields = Object.fromEntries(
        [...form.entries()].filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      );
      const reply = await postJson('/api/counts', { ...fields, uploadKey: target.uploadKey });
      const body = readReply(reply.body);
      if (!reply.ok || !body.id) throw new Error(serverError(reply));
      id = body.id;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo subir la foto.');
      setPhase('idle');
      return;
    }

    // Si la detección falla, el conteo queda en `error` y la pantalla del conteo lo muestra.
    const startedAt = Date.now();
    setDetectStartedAt(startedAt);
    setPhase('detecting');
    await fetch(`/api/counts/${id}/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(method ? { detector: method } : {}),
    }).catch(() => undefined);

    setDetectMs(Date.now() - startedAt);
    setDetectStartedAt(null);
    setPhase('opening');
    // Si la persona ya navegó a otra pantalla, no se la saca de ahí.
    if (mounted.current) router.push(`/conteos/${id}`);
  };

  return (
    <main className="page new-count">
      <header className="page-header new-count__header">
        <div className="page-header__text">
          <nav aria-label="Ruta">
            <ol className="breadcrumb">
              <li>
                <Link href="/conteos">Conteos</Link>
              </li>
              <li aria-current="page">Nuevo conteo</li>
            </ol>
          </nav>
          <h1>Nuevo conteo</h1>
          <p>
            Sube la foto original del dron, sin recortar ni reducir: los animales miden 10–20 px y
            el detector necesita la resolución completa.
          </p>
        </div>
      </header>

      <form className="new-count__layout" onSubmit={onSubmit}>
        <div className="new-count__photo" ref={photoRef}>
          <PhotoDropzone
            name="image"
            disabled={busy}
            scanning={phase === 'detecting'}
            readout={
              phase === 'idle' ? undefined : (
                <UploadSteps
                  active={STEP_OF[phase]}
                  upload={upload}
                  method={methodLabel(catalog, method)}
                  detectMs={phase === 'detecting' ? elapsed : detectMs}
                />
              )
            }
          />
          {error && (
            <div
              ref={errorRef}
              tabIndex={-1}
              className="callout callout--danger new-count__error"
              role="alert"
            >
              <AlertTriangleIcon size={16} />
              <div>
                <p className="new-count__error-title">La foto no se subió</p>
                <p>{error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="panel new-count__panel">
          <fieldset className="new-count__fields" disabled={busy}>
            <legend className="visually-hidden">Datos del conteo</legend>

            <div className="field">
              <label className="field__label" htmlFor={farmId}>
                Finca
              </label>
              <input
                id={farmId}
                name="farm"
                required
                maxLength={100}
                placeholder="Ej. Guaicaramo"
                autoComplete="off"
                list={farms.length > 0 ? `${farmId}-list` : undefined}
                value={farm}
                onChange={(event) => setFarm(event.target.value)}
              />
              {farms.length > 0 && (
                <>
                  <datalist id={`${farmId}-list`}>
                    {farms.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                  <div className="new-count__farms" role="group" aria-label="Fincas usadas antes">
                    {farms.slice(0, FARM_CHIPS).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className="new-count__farm"
                        aria-pressed={farm.trim() === f}
                        onClick={() => setFarm(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="new-count__row">
              <label className="field">
                <span className="field__label">Potrero</span>
                <input name="pastureId" required placeholder="Ej. Potrero 12" autoComplete="off" />
              </label>
              <label className="field">
                <span className="field__label">Fecha de vuelo</span>
                <input name="flightDate" type="date" required max={today} />
              </label>
            </div>

            <fieldset className="field new-count__species">
              <legend className="field__label">Especie</legend>
              <div className="segmented">
                {SPECIES.map((s) => (
                  <label key={s}>
                    <input
                      type="radio"
                      name="species"
                      value={s}
                      defaultChecked={s === DEFAULT_SPECIES}
                    />
                    {SPECIES_LABELS[s]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="new-count__section">
              <MethodSelect
                name={methodField}
                catalog={catalog}
                value={method}
                onChange={setMethod}
              />
            </div>

            <details className="new-count__more">
              <summary>
                <ChevronDownIcon size={16} className="new-count__chevron" />
                Metadatos de vuelo
                <span className="new-count__optional">opcional</span>
              </summary>
              <div className="new-count__more-body">
                <div className="new-count__row">
                  <label className="field">
                    <span className="field__label">Altura</span>
                    <span className="new-count__unit" data-unit="m">
                      <input
                        name="altitudeM"
                        type="number"
                        min="1"
                        step="any"
                        inputMode="decimal"
                        placeholder="Ej. 80"
                      />
                    </span>
                  </label>
                  <label className="field">
                    <span className="field__label">Ángulo de cámara</span>
                    <span className="new-count__unit" data-unit="°">
                      <input
                        name="cameraAngleDeg"
                        type="number"
                        min="0"
                        max="90"
                        step="any"
                        inputMode="decimal"
                        placeholder="Ej. 90"
                        aria-describedby="new-count-angle-hint"
                      />
                    </span>
                    <span className="field__hint" id="new-count-angle-hint">
                      90° = cenital, mirando hacia abajo
                    </span>
                  </label>
                </div>
                <label className="field">
                  <span className="field__label">Observaciones</span>
                  <textarea
                    name="notes"
                    rows={3}
                    maxLength={1000}
                    placeholder="Ej. viento fuerte, nubes sobre el lote norte"
                  />
                </label>
              </div>
            </details>
          </fieldset>

          <div className="new-count__submit">
            <button
              type="submit"
              className="button button--primary button--lg button--block"
              aria-busy={busy}
              disabled={!busy && catalog !== null && method === ''}
            >
              {busy ? <span className="spinner" aria-hidden="true" /> : <UploadIcon size={18} />}
              Subir y detectar
            </button>
          </div>
        </div>

        <p className="visually-hidden" aria-live="polite">
          {ANNOUNCEMENTS[phase]}
        </p>
      </form>
    </main>
  );
}

function serverError(reply: JsonReply): string {
  return readReply(reply.body).error ?? `El servidor respondió con el error ${reply.status}.`;
}

/**
 * En una columna (móvil) la foto queda arriba, fuera de vista: se trae para ver el progreso, que
 * aparece al pie del visor. En escritorio la columna de la foto es fija y ya está a la vista.
 */
function revealProgress(element: HTMLElement | null) {
  if (!element) return;
  const { bottom } = element.getBoundingClientRect();
  if (bottom > 96 && bottom <= window.innerHeight) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}
