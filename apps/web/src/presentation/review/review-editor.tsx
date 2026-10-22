'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { Detection, ImageSize } from '@/domain/index';
import { useConfirm } from '../ui/confirm-dialog';
import { EyeIcon } from '../ui/icons';
import { createPointerStore } from './pointer-store';
import { formatAnimals } from './review-format';
import {
  ImageStatus,
  Legend,
  Minimap,
  PointerReadout,
  Toolbar,
  type PhotoState,
} from './review-hud';
import { HoverRing, MarksLayer } from './review-marks';
import { ReviewPanel } from './review-panel';
import type { ReviewerView } from '../view-models';
import { hitTest, initialReviewState, reviewReducer, summarize } from './review-state';
import {
  MAX_SCALE,
  PIXELATED_FROM_SCALE,
  centerOn,
  fitView,
  hitRadius,
  isInsideImage,
  minScale,
  nextScale,
  pinchView,
  toImagePoint,
  zoomAround,
  type Point,
  type View,
} from './view-math';

interface ReviewEditorProps {
  readonly countId: string;
  readonly imageUrl: string;
  readonly image: ImageSize;
  readonly detections: readonly Detection[];
  readonly readOnly: boolean;
  /** Usuario de la sesión que confirmaría. `null` si su rol no puede revisar (solo lectura). */
  readonly reviewer: ReviewerView | null;
  /** Controles adicionales al final del panel (ej. volver a detectar). */
  readonly extraTools?: ReactNode;
}

/** `animate`: los cambios por botón o teclado se interpolan; la rueda y el arrastre son inmediatos. */
interface ViewState extends View {
  readonly animate: boolean;
}

interface Drag {
  readonly x: number;
  readonly y: number;
  readonly tx: number;
  readonly ty: number;
  moved: boolean;
}

interface Pinch {
  readonly view: View;
  readonly mid: Point;
  readonly distance: number;
}

const DRAG_THRESHOLD_PX = 4;
const ZOOM_STEP = 1.25;
/** Paso de las flechas: una fracción del visor. */
const PAN_STEP = 0.15;

/**
 * Editor de revisión. La imagen se muestra a resolución completa y las marcas se dibujan en un SVG
 * cuyo `viewBox` es la imagen original: toda coordenada que se guarda está en píxeles originales.
 */
export function ReviewEditor({
  countId,
  imageUrl,
  image,
  detections,
  readOnly: reviewed,
  reviewer,
  extraTools,
}: ReviewEditorProps) {
  const readOnly = reviewed || reviewer === null;
  const router = useRouter();
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(reviewReducer, detections, initialReviewState);
  const [initialIds] = useState<ReadonlySet<string>>(() => new Set(detections.map((d) => d.id)));
  const [pointer] = useState(createPointerStore);
  const [view, setView] = useState<ViewState>({ scale: 0, tx: 0, ty: 0, animate: false });
  const [viewport, setViewport] = useState<ImageSize>({ width: 0, height: 0 });
  const [marksHidden, setMarksHidden] = useState(false);
  const [imageState, setImageState] = useState<PhotoState>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  /** Una vez que el revisor mueve o acerca la vista, ya no se reajusta sola. */
  const touched = useRef(false);
  const drag = useRef<Drag | null>(null);
  /** Punteros activos sobre la foto (coordenadas de cliente), para el pellizco táctil. */
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<Pinch | null>(null);

  const { width: imageWidth, height: imageHeight } = image;
  const imageSize = useMemo(
    () => ({ width: imageWidth, height: imageHeight }),
    [imageWidth, imageHeight],
  );
  const summary = useMemo(() => summarize(state.detections), [state.detections]);
  const dirty = state.history.length > 0;
  const fitScale = viewport.width > 0 ? fitView(viewport, imageSize).scale : 0;

  const measure = useCallback((): ImageSize | undefined => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    // Tamaño de maquetación: no le afectan las transformaciones de la entrada de página.
    const { clientWidth: width, clientHeight: height } = frame;
    return width > 0 && height > 0 ? { width, height } : undefined;
  }, []);

  const fit = useCallback(() => {
    const size = measure();
    if (!size) return;
    // Ajustar a mano vuelve a dejar que la vista siga al tamaño del visor.
    touched.current = false;
    setView({ ...fitView(size, imageSize), animate: true });
  }, [measure, imageSize]);

  /**
   * Cambia la escala dejando fijo el punto `anchor` del visor (por defecto, su centro). `floor`
   * permite bajar del mínimo a propósito (tamaño real en una foto más pequeña que el visor).
   */
  const zoom = useCallback(
    (
      next: (scale: number) => number,
      anchor: Point | undefined,
      animate: boolean,
      floor?: number,
    ) => {
      const size = measure();
      if (!size) return;
      const center = anchor ?? { x: size.width / 2, y: size.height / 2 };
      const lowest = minScale(size, imageSize);
      const stage = stageRef.current;
      touched.current = true;
      setView((current) => {
        if (current.scale <= 0) return current;
        // La rueda parte de lo que se ve: si un zoom animado sigue en curso, no salta a su destino.
        const v = animate ? current : liveView(stage, current);
        return {
          ...zoomAround(v, nextScale(v.scale, next(v.scale), lowest, floor), center),
          animate,
        };
      });
    },
    [measure, imageSize],
  );

  const zoomIn = useCallback(() => zoom((s) => s * ZOOM_STEP, undefined, true), [zoom]);
  const zoomOut = useCallback(() => zoom((s) => s / ZOOM_STEP, undefined, true), [zoom]);
  const actualSize = useCallback(() => zoom(() => 1, undefined, true, 1), [zoom]);
  const toggleMarks = useCallback(() => setMarksHidden((hidden) => !hidden), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);

  const navigate = useCallback(
    (point: Point, animate: boolean) => {
      const size = measure();
      if (!size) return;
      touched.current = true;
      setView((v) => ({ ...centerOn(v, size, point), animate }));
    },
    [measure],
  );

  // Ajusta la imagen a la vista en cuanto el visor tiene tamaño (y si cambia antes de interactuar).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(() => {
      const size = measure();
      if (!size) return;
      setViewport(size);
      if (touched.current) return;
      const next = fitView(size, imageSize);
      if (next.scale > 0) setView({ ...next, animate: false });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [measure, imageSize]);

  // La rueda necesita un listener no pasivo para poder evitar el scroll de la página.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = frame.getBoundingClientRect();
      // Firefox puede medir la rueda en líneas: se pasa a píxeles aproximados.
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      zoom(
        (s) => s * Math.exp(-delta * 0.0015),
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        false,
      );
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [zoom]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (!readOnly) dispatch({ type: 'undo' });
        return;
      }
      // Los atajos de una tecla no deben robar los del navegador (Ctrl+F, Ctrl+0…).
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'f' || key === '0') fit();
      else if (key === '1') actualSize();
      else if (key === 'h') toggleMarks();
      else if (key === '+' || key === '=') zoomIn();
      else if (key === '-') zoomOut();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fit, actualSize, toggleMarks, zoomIn, zoomOut, readOnly]);

  useEffect(() => {
    if (readOnly || !dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [readOnly, dirty]);

  /** Coordenadas de cliente → punto del visor (relativo a su esquina superior izquierda). */
  const localPoint = (clientX: number, clientY: number): Point | undefined => {
    const rect = frameRef.current?.getBoundingClientRect();
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : undefined;
  };

  const imagePointAt = (clientX: number, clientY: number): Point | undefined => {
    const local = localPoint(clientX, clientY);
    if (!local || view.scale <= 0) return undefined;
    const point = toImagePoint(view, local);
    return isInsideImage(point, imageSize) ? point : undefined;
  };

  const startPinch = (base: View) => {
    const [a, b] = [...pointers.current.values()];
    const mid = a && b && localPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
    if (!a || !b || !mid) return;
    pinch.current = { view: base, mid, distance: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1) };
    drag.current = null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    // Tocar la foto detiene un zoom animado donde está: el clic y el arrastre usan lo que se ve.
    const current = liveView(stageRef.current, view);
    if (current !== view) setView(current);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      startPinch(current);
      pointer.set(null);
    } else if (pointers.current.size === 1) {
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        tx: current.tx,
        ty: current.ty,
        moved: false,
      };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    // La lectura de coordenadas y el resalte solo siguen al ratón o al lápiz, no al dedo.
    if (event.pointerType !== 'touch') {
      pointer.set(imagePointAt(event.clientX, event.clientY) ?? null);
    }
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const start = pinch.current;
    if (start) {
      const [a, b] = [...pointers.current.values()];
      const mid = a && b && localPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (!a || !b || !mid || viewport.width === 0) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      // Como en `nextScale`: si ya estaba bajo el mínimo, el pellizco no la fuerza hacia arriba.
      const lowest = Math.min(minScale(viewport, imageSize), start.view.scale);
      touched.current = true;
      setView({
        ...pinchView(start.view, start.mid, start.distance, mid, distance, lowest),
        animate: false,
      });
      return;
    }

    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    if (!current.moved) event.currentTarget.dataset.dragging = '';
    current.moved = true;
    touched.current = true;
    setView((v) => ({ ...v, tx: current.tx + dx, ty: current.ty + dy, animate: false }));
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) delete event.currentTarget.dataset.dragging;
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const tracked = pointers.current.has(event.pointerId);
    endPointer(event);
    if (pinch.current) {
      // Al levantar un dedo, el que queda sigue moviendo la vista pero ya no cuenta como clic.
      if (pointers.current.size < 2) {
        pinch.current = null;
        const [rest] = [...pointers.current.values()];
        drag.current = rest
          ? { x: rest.x, y: rest.y, tx: view.tx, ty: view.ty, moved: true }
          : null;
      }
      return;
    }
    const current = drag.current;
    drag.current = null;
    if (!tracked || !current || current.moved || readOnly || marksHidden) return;
    // Sin la foto a la vista no se marca: mover y acercar sí, pero nada de contar a ciegas.
    if (imageState !== 'ready') return;
    const point = imagePointAt(event.clientX, event.clientY);
    if (!point) return;
    const hit = hitTest(state.detections, point.x, point.y, hitRadius(view.scale));
    if (hit) dispatch({ type: 'toggle', id: hit.id });
    else dispatch({ type: 'add', x: point.x, y: point.y, image });
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    endPointer(event);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  };

  // Con el foco en la foto, las flechas mueven la vista: el teclado llega a toda la imagen.
  const onSurfaceKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const direction = ARROWS[event.key];
    if (!direction || viewport.width === 0) return;
    event.preventDefault();
    touched.current = true;
    setView((v) => ({
      ...v,
      tx: v.tx + direction.x * viewport.width * PAN_STEP,
      ty: v.ty + direction.y * viewport.height * PAN_STEP,
      animate: true,
    }));
  };

  const imageRef = useCallback((node: HTMLImageElement | null) => {
    // La foto pudo cargar, o fallar, antes de hidratar: entonces no llegan `onLoad` ni `onError`.
    if (node?.complete) setImageState(node.naturalWidth > 0 ? 'ready' : 'error');
  }, []);

  const submit = useCallback(async () => {
    // El botón queda inactivo sin la foto: nadie confirma un conteo que no ha visto.
    if (submitting || imageState !== 'ready' || !reviewer) return;
    setSubmitError(null);
    const confirmed = await confirm({
      title: `¿Confirmar el conteo con ${formatAnimals(summary.total)}?`,
      body: `Quedará como dato oficial a nombre de ${reviewer.name} (${reviewer.id}) y no se podrá editar.`,
      confirmLabel: 'Confirmar conteo',
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/counts/${countId}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ detections: state.detections }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Error ${response.status}`);
      }
      dispatch({ type: 'reset', detections: state.detections });
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo guardar la revisión.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, imageState, reviewer, confirm, summary.total, countId, state.detections, router]);

  const ready = view.scale > 0;
  const photoReady = imageState === 'ready';
  const stageStyle = {
    width: image.width,
    height: image.height,
    '--review-s': ready ? view.scale : 1,
    '--review-tx': view.tx,
    '--review-ty': view.ty,
  } as CSSProperties;

  return (
    <div
      className={`review${readOnly ? ' review--readonly' : ''}`}
      // En móvil el alto del visor sigue la proporción de la foto (ver review.css).
      style={{ '--review-ratio': image.width / image.height } as CSSProperties}
    >
      <div ref={frameRef} className="review-viewport" data-photo={imageState}>
        <div
          className="review-surface"
          role="application"
          tabIndex={0}
          aria-label={
            readOnly
              ? 'Foto aérea con las marcas revisadas. Arrastra o usa las flechas para mover; rueda para acercar.'
              : 'Foto aérea con las marcas. Clic para añadir o descartar; arrastra o usa las flechas para mover; rueda para acercar.'
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={() => pointer.set(null)}
          onKeyDown={onSurfaceKeyDown}
        >
          <div
            ref={stageRef}
            className={`review-stage${view.animate ? ' review-stage--animate' : ''}`}
            data-ready={ready || undefined}
            style={stageStyle}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image reescalaría la foto; la revisión exige resolución completa. */}
            <img
              ref={imageRef}
              src={imageUrl}
              width={image.width}
              height={image.height}
              alt={`Foto aérea del conteo ${countId}`}
              draggable={false}
              onLoad={() => setImageState('ready')}
              onError={() => setImageState('error')}
              style={{ imageRendering: view.scale >= PIXELATED_FROM_SCALE ? 'pixelated' : 'auto' }}
            />
            {ready && (
              <MarksLayer
                detections={state.detections}
                image={imageSize}
                initialIds={initialIds}
                hidden={marksHidden}
              />
            )}
            {ready && photoReady && !readOnly && !marksHidden && (
              <HoverRing
                store={pointer}
                detections={state.detections}
                image={imageSize}
                scale={view.scale}
              />
            )}
          </div>
        </div>

        <div className="review-hud">
          <div className="review-hud__corner">
            {readOnly && (
              <p className="review-hud-box review-chip">
                <EyeIcon />
                Solo lectura
              </p>
            )}
            <Legend readOnly={readOnly} marksHidden={marksHidden} />
          </div>
          <Minimap
            imageUrl={imageUrl}
            image={imageSize}
            view={view}
            viewport={viewport}
            visible={ready && photoReady && fitScale > 0 && view.scale > fitScale * 1.02}
            onNavigate={navigate}
          />
          <PointerReadout store={pointer} image={imageSize} />
          <Toolbar
            ready={ready}
            scale={view.scale}
            canZoomIn={view.scale < MAX_SCALE - 1e-6}
            canZoomOut={view.scale > fitScale / 2 + 1e-6}
            marksHidden={marksHidden}
            readOnly={readOnly}
            canUndo={dirty}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onActualSize={actualSize}
            onFit={fit}
            onToggleMarks={toggleMarks}
            onUndo={undo}
          />
        </div>

        {imageState !== 'ready' && <ImageStatus state={imageState} />}
      </div>

      <ReviewPanel
        readOnly={readOnly}
        photo={imageState}
        summary={summary}
        dirty={dirty}
        reviewed={reviewed}
        reviewer={reviewer}
        submitError={submitError}
        submitting={submitting}
        onSubmit={submit}
        extraTools={extraTools}
      />
      {confirmDialog}
    </div>
  );
}

/**
 * La vista que se ve en pantalla. Durante un zoom animado el estado ya tiene el destino, pero el
 * navegador aún interpola `--review-*`: se leen los valores en curso para no marcar en otro punto.
 */
function liveView(stage: HTMLElement | null, view: ViewState): ViewState {
  if (!view.animate || !stage) return view;
  const style = getComputedStyle(stage);
  const read = (name: string, fallback: number) => {
    const value = Number.parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    scale: read('--review-s', view.scale),
    tx: read('--review-tx', view.tx),
    ty: read('--review-ty', view.ty),
    animate: false,
  };
}

const ARROWS: Readonly<Record<string, Point>> = {
  ArrowLeft: { x: 1, y: 0 },
  ArrowRight: { x: -1, y: 0 },
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
};

/** Los atajos no actúan mientras se escribe ni dentro de un diálogo. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    target.closest('dialog') !== null
  );
}
