'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { Detection, ImageSize } from '@/domain/index';
import { hitTest, initialReviewState, reviewReducer, summarize } from './review-state';

interface ReviewEditorProps {
  readonly countId: string;
  readonly imageUrl: string;
  readonly image: ImageSize;
  readonly detections: readonly Detection[];
  readonly readOnly: boolean;
  /** Controles adicionales al final del panel (ej. volver a detectar). */
  readonly extraTools?: ReactNode;
}

interface View {
  readonly scale: number;
  readonly tx: number;
  readonly ty: number;
}

const MAX_SCALE = 8;
const DRAG_THRESHOLD_PX = 4;
const REVIEWER_STORAGE_KEY = 'hatoscan.reviewerId';
const REVIEWER_PATTERN = /^SIRIUS-PER-\d{4,}$/;

/**
 * Editor de revisión. La imagen se muestra a resolución completa y las marcas se dibujan en un SVG
 * cuyo `viewBox` es la imagen original: toda coordenada que se guarda está en píxeles originales.
 */
export function ReviewEditor({
  countId,
  imageUrl,
  image,
  detections,
  readOnly,
  extraTools,
}: ReviewEditorProps) {
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(reviewReducer, detections, initialReviewState);
  const [view, setView] = useState<View>({ scale: 0, tx: 0, ty: 0 });
  const [marksHidden, setMarksHidden] = useState(false);
  const reviewerRef = useRef<HTMLInputElement>(null);
  /** Una vez que el revisor mueve o acerca la vista, ya no se reajusta sola. */
  const touched = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(
    null,
  );

  const summary = summarize(state.detections);
  const dirty = state.history.length > 0;

  const fitView = useCallback((): View | undefined => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const { width, height } = viewport.getBoundingClientRect();
    const scale = Math.min(width / image.width, height / image.height);
    return {
      scale,
      tx: (width - image.width * scale) / 2,
      ty: (height - image.height * scale) / 2,
    };
  }, [image.width, image.height]);

  const fit = useCallback(() => {
    const next = fitView();
    if (next) setView(next);
  }, [fitView]);

  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const viewport = viewportRef.current;
      const minScale = (fitView()?.scale ?? 1) / 2;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const cx = (clientX ?? rect.left + rect.width / 2) - rect.left;
      const cy = (clientY ?? rect.top + rect.height / 2) - rect.top;
      touched.current = true;
      setView((v) => {
        const scale = Math.min(Math.max(v.scale * factor, minScale), MAX_SCALE);
        const ratio = scale / v.scale;
        return { scale, tx: cx - (cx - v.tx) * ratio, ty: cy - (cy - v.ty) * ratio };
      });
    },
    [fitView],
  );

  // Ajusta la imagen a la vista en cuanto el visor tiene tamaño (y si cambia antes de interactuar).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      if (touched.current) return;
      const next = fitView();
      if (next && next.scale > 0) setView(next);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitView]);

  // La rueda necesita un listener no pasivo para poder evitar el scroll de la página.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => {
    try {
      const remembered = window.localStorage.getItem(REVIEWER_STORAGE_KEY);
      if (remembered && reviewerRef.current && !reviewerRef.current.value) {
        reviewerRef.current.value = remembered;
      }
    } catch {
      // Sin almacenamiento local: el revisor escribe su ID cada vez.
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (!readOnly) dispatch({ type: 'undo' });
      } else if (event.key === 'f' || event.key === '0') {
        fit();
      } else if (event.key === 'h') {
        setMarksHidden((hidden) => !hidden);
      } else if (event.key === '+' || event.key === '=') {
        zoomAt(1.25);
      } else if (event.key === '-') {
        zoomAt(0.8);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fit, zoomAt, readOnly]);

  useEffect(() => {
    if (readOnly || !dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [readOnly, dirty]);

  const toImagePoint = (clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    const x = (clientX - rect.left - view.tx) / view.scale;
    const y = (clientY - rect.top - view.ty) / view.scale;
    if (x < 0 || y < 0 || x > image.width || y > image.height) return undefined;
    return { x, y };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    current.moved = true;
    touched.current = true;
    setView((v) => ({ ...v, tx: current.tx + dx, ty: current.ty + dy }));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    drag.current = null;
    if (!current || current.moved || readOnly || marksHidden) return;
    const point = toImagePoint(event.clientX, event.clientY);
    if (!point) return;
    const hit = hitTest(
      state.detections,
      point.x,
      point.y,
      markRadius(view.scale) + 3 / view.scale,
    );
    if (hit) dispatch({ type: 'toggle', id: hit.id });
    else dispatch({ type: 'add', x: point.x, y: point.y, image });
  };

  const submit = async () => {
    setSubmitError(null);
    const reviewer = reviewerRef.current?.value.trim() ?? '';
    if (!REVIEWER_PATTERN.test(reviewer)) {
      setSubmitError('Escribe tu ID de revisor con el formato SIRIUS-PER-0000.');
      return;
    }
    if (
      !window.confirm(`¿Confirmar el conteo con ${summary.total} animales? No se podrá editar.`)
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/counts/${countId}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewerId: reviewer, detections: state.detections }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Error ${response.status}`);
      }
      try {
        window.localStorage.setItem(REVIEWER_STORAGE_KEY, reviewer);
      } catch {
        // Recordar el revisor es solo una comodidad.
      }
      dispatch({ type: 'reset', detections: state.detections });
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo guardar la revisión.');
    } finally {
      setSubmitting(false);
    }
  };

  const radius = markRadius(view.scale);
  const stroke = 2 / Math.max(view.scale, 1e-6);

  return (
    <div className="review">
      <div
        ref={viewportRef}
        className={`review__viewport${readOnly ? ' review__viewport--readonly' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        role="application"
        aria-label="Imagen aérea con las detecciones. Arrastra para mover, rueda para acercar."
      >
        <div
          className="review__stage"
          style={{
            width: image.width,
            height: image.height,
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            visibility: view.scale > 0 ? 'visible' : 'hidden',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image reescalaría la foto; la revisión exige resolución completa. */}
          <img
            src={imageUrl}
            width={image.width}
            height={image.height}
            alt={`Foto aérea del conteo ${countId}`}
            draggable={false}
            style={{ imageRendering: view.scale >= 2 ? 'pixelated' : 'auto' }}
          />
          {!marksHidden && (
            <svg
              className="review__marks"
              viewBox={`0 0 ${image.width} ${image.height}`}
              width={image.width}
              height={image.height}
              aria-hidden="true"
            >
              {state.detections.map((d) => (
                <Mark key={d.id} detection={d} radius={radius} stroke={stroke} />
              ))}
            </svg>
          )}
        </div>
      </div>

      <aside className="review__panel">
        <dl className="review__totals">
          <div className="review__total review__total--main">
            <dt>{readOnly ? 'Total revisado' : 'Total a confirmar'}</dt>
            <dd>{summary.total}</dd>
          </div>
          <div className="review__total">
            <dt>
              <span className="swatch swatch--model" /> Propuestas del modelo
            </dt>
            <dd>{summary.model}</dd>
          </div>
          <div className="review__total">
            <dt>
              <span className="swatch swatch--model" /> Confirmadas
            </dt>
            <dd>{summary.confirmed}</dd>
          </div>
          <div className="review__total">
            <dt>
              <span className="swatch swatch--discarded" /> Descartadas
            </dt>
            <dd>{summary.discarded}</dd>
          </div>
          <div className="review__total">
            <dt>
              <span className="swatch swatch--human" /> Añadidas por ti
            </dt>
            <dd>{summary.added}</dd>
          </div>
        </dl>

        <div className="review__tools">
          <button type="button" onClick={() => zoomAt(1.25)} aria-label="Acercar">
            +
          </button>
          <button type="button" onClick={() => zoomAt(0.8)} aria-label="Alejar">
            −
          </button>
          <button type="button" onClick={fit}>
            Ajustar
          </button>
          <button
            type="button"
            onClick={() => setMarksHidden((h) => !h)}
            aria-pressed={marksHidden}
          >
            {marksHidden ? 'Mostrar marcas' : 'Ocultar marcas'}
          </button>
          {!readOnly && (
            <button type="button" onClick={() => dispatch({ type: 'undo' })} disabled={!dirty}>
              Deshacer
            </button>
          )}
        </div>

        {readOnly ? (
          <p className="review__help">Conteo revisado: solo lectura.</p>
        ) : (
          <>
            <ul className="review__help">
              <li>Clic en un animal sin marca: lo añade.</li>
              <li>Clic en una marca del modelo: la descarta o la restaura.</li>
              <li>Clic en una marca tuya: la quita.</li>
              <li>
                Arrastra para mover · rueda o +/− para acercar · H oculta marcas · Ctrl+Z deshace.
              </li>
            </ul>
            <label className="field">
              <span>ID del revisor</span>
              <input
                ref={reviewerRef}
                placeholder="SIRIUS-PER-0000"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            {submitError && (
              <p className="form-error" role="alert">
                {submitError}
              </p>
            )}
            <button
              type="button"
              className="button button--primary"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? 'Guardando…' : `Confirmar conteo (${summary.total})`}
            </button>
          </>
        )}
        {extraTools}
      </aside>
    </div>
  );
}

/** Radio de las marcas en píxeles originales: ~10 px, pero nunca menos de 6 px en pantalla. */
function markRadius(scale: number): number {
  return Math.max(10, 6 / Math.max(scale, 1e-6));
}

function Mark({
  detection: d,
  radius,
  stroke,
}: {
  detection: Detection;
  radius: number;
  stroke: number;
}) {
  const variant =
    d.estado === 'descartada' ? 'discarded' : d.origen === 'humano' ? 'human' : 'model';
  const common = {
    className: `mark mark--${variant}`,
    strokeWidth: stroke,
    ...(variant === 'discarded' && { strokeDasharray: `${stroke * 2} ${stroke * 2}` }),
  };
  if (d.tipo === 'caja' && d.w !== undefined && d.h !== undefined) {
    return <rect x={d.x} y={d.y} width={d.w} height={d.h} {...common} />;
  }
  return <circle cx={d.x} cy={d.y} r={radius} {...common} />;
}
