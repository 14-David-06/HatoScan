'use client';

import { useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { ImageSize } from '@/domain/index';
import { formatInteger } from '../format';
import {
  AlertTriangleIcon,
  EyeIcon,
  EyeOffIcon,
  FitIcon,
  MinusIcon,
  PlusIcon,
  UndoIcon,
} from '../ui/icons';
import type { PointerStore } from './pointer-store';
import { formatZoom } from './review-format';
import { visibleRegion, type Point, type View } from './view-math';

/* Piezas del HUD que flotan sobre la foto. Siempre oscuras: el visor es oscuro en ambos temas. */

export type MarkVariant = 'model' | 'human' | 'discarded';

/** Carga de la foto: sin ella no se añaden marcas ni se confirma el conteo. */
export type PhotoState = 'loading' | 'ready' | 'error';

/** Muestra de una marca tal como se dibuja sobre la foto. */
export function MarkGlyph({ variant }: { variant: MarkVariant }) {
  return (
    <svg className={`review-glyph review-glyph--${variant}`} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5.25" pathLength={24} />
    </svg>
  );
}

export function Legend({ readOnly, marksHidden }: { readOnly: boolean; marksHidden: boolean }) {
  if (marksHidden) {
    return (
      <p className="review-hud-box review-legend review-legend--off">
        <EyeOffIcon />
        Marcas ocultas
        <kbd className="kbd">H</kbd>
      </p>
    );
  }
  return (
    <ul className="review-hud-box review-legend" aria-label="Leyenda de las marcas">
      <li>
        <MarkGlyph variant="model" />
        Modelo
      </li>
      <li>
        <MarkGlyph variant="human" />
        {readOnly ? 'Revisor' : 'Tuyas'}
      </li>
      <li>
        <MarkGlyph variant="discarded" />
        Descartadas
      </li>
    </ul>
  );
}

interface ToolbarProps {
  /** Falso hasta que el visor mide y ajusta la foto (en el servidor no hay escala). */
  readonly ready: boolean;
  readonly scale: number;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly marksHidden: boolean;
  readonly readOnly: boolean;
  readonly canUndo: boolean;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onActualSize: () => void;
  readonly onFit: () => void;
  readonly onToggleMarks: () => void;
  readonly onUndo: () => void;
}

export function Toolbar(props: ToolbarProps) {
  // Sin escala todavía no hay zoom que mostrar: nada de «0 %» en el primer pintado.
  const zoom = props.ready && props.scale > 0 ? formatZoom(props.scale) : '';
  return (
    <div
      className="review-hud-box review-toolbar"
      role="group"
      aria-label="Vista de la foto"
      data-ready={props.ready || undefined}
      aria-hidden={props.ready ? undefined : true}
    >
      <ToolButton
        label="Alejar"
        keys={['−']}
        shortcut="-"
        onClick={props.onZoomOut}
        disabled={!props.canZoomOut}
      >
        <MinusIcon />
      </ToolButton>
      <ToolButton
        label={zoom ? `Ver a tamaño real (zoom actual: ${zoom})` : 'Ver a tamaño real'}
        tip="Tamaño real"
        keys={['1']}
        shortcut="1"
        onClick={props.onActualSize}
        className="review-tool--zoom"
      >
        <span className="review-toolbar__zoom">{zoom}</span>
      </ToolButton>
      <ToolButton
        label="Acercar"
        keys={['+']}
        shortcut="Plus ="
        onClick={props.onZoomIn}
        disabled={!props.canZoomIn}
      >
        <PlusIcon />
      </ToolButton>
      <span className="review-toolbar__sep" aria-hidden="true" />
      <ToolButton label="Ajustar a la vista" keys={['F']} shortcut="F" onClick={props.onFit}>
        <FitIcon />
      </ToolButton>
      <ToolButton
        label="Ocultar marcas"
        tip={props.marksHidden ? 'Mostrar marcas' : 'Ocultar marcas'}
        keys={['H']}
        shortcut="H"
        pressed={props.marksHidden}
        onClick={props.onToggleMarks}
      >
        {props.marksHidden ? <EyeOffIcon /> : <EyeIcon />}
      </ToolButton>
      {!props.readOnly && (
        <>
          <span className="review-toolbar__sep" aria-hidden="true" />
          <ToolButton
            label="Deshacer"
            keys={['Ctrl', 'Z']}
            shortcut="Control+Z Meta+Z"
            onClick={props.onUndo}
            disabled={!props.canUndo}
          >
            <UndoIcon />
          </ToolButton>
        </>
      )}
    </div>
  );
}

function ToolButton({
  label,
  tip,
  keys,
  shortcut,
  pressed,
  disabled,
  className,
  onClick,
  children,
}: {
  label: string;
  /** Texto de la pista si difiere de la etiqueta accesible. */
  tip?: string;
  keys: readonly string[];
  shortcut?: string;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className ? `review-tool ${className}` : 'review-tool'}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
      <span className="review-tip" aria-hidden="true">
        {tip ?? label}
        <span className="review-tip__keys">
          {keys.map((key) => (
            <kbd key={key} className="kbd">
              {key}
            </kbd>
          ))}
        </span>
      </span>
    </button>
  );
}

/** «x 1 203  y 554 px» bajo el puntero, en píxeles de la imagen original. */
export function PointerReadout({ store, image }: { store: PointerStore; image: ImageSize }) {
  const point = useSyncExternalStore(store.subscribe, store.get, () => null);
  // Ancho fijo por eje para que la lectura no baile al cambiar el número de cifras.
  const style = {
    '--coord-x': `${formatInteger(image.width).length}ch`,
    '--coord-y': `${formatInteger(image.height).length}ch`,
  } as CSSProperties;
  return (
    <p
      className="review-hud-box review-coords"
      data-visible={point ? true : undefined}
      style={style}
      aria-hidden="true"
    >
      <span className="review-coords__axis">x</span>
      <span className="review-coords__value review-coords__value--x">
        {point && formatInteger(point.x)}
      </span>
      <span className="review-coords__axis">y</span>
      <span className="review-coords__value review-coords__value--y">
        {point && formatInteger(point.y)}
      </span>
      <span className="review-coords__unit">px</span>
    </p>
  );
}

/**
 * Minimapa: la misma foto escalada por CSS con el rectángulo visible. Clic o arrastre centran la
 * vista en ese punto. Es una ayuda para el ratón; con teclado se mueve la vista con las flechas.
 */
export function Minimap({
  imageUrl,
  image,
  view,
  viewport,
  visible,
  onNavigate,
}: {
  imageUrl: string;
  image: ImageSize;
  view: View;
  viewport: ImageSize;
  visible: boolean;
  onNavigate: (point: Point, animate: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const region = visibleRegion(view, viewport, image);

  const pointFrom = (clientX: number, clientY: number): Point | undefined => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return undefined;
    const x = ((clientX - rect.left) / rect.width) * image.width;
    const y = ((clientY - rect.top) / rect.height) * image.height;
    return {
      x: Math.min(Math.max(x, 0), image.width),
      y: Math.min(Math.max(y, 0), image.height),
    };
  };

  return (
    <div
      ref={ref}
      className="review-hud-box review-minimap"
      data-visible={visible || undefined}
      style={{ '--minimap-ratio': image.width / image.height } as CSSProperties}
      aria-hidden="true"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        const point = pointFrom(event.clientX, event.clientY);
        if (point) onNavigate(point, true);
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        const point = pointFrom(event.clientX, event.clientY);
        if (point) onNavigate(point, false);
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- la misma foto ya cargada, escalada por CSS. */}
      <img src={imageUrl} alt="" draggable={false} decoding="async" />
      <svg viewBox={`0 0 ${image.width} ${image.height}`} preserveAspectRatio="none">
        {region && (
          <>
            <path
              className="review-minimap__shade"
              fillRule="evenodd"
              d={`M0 0H${image.width}V${image.height}H0Z M${region.x} ${region.y}h${region.width}v${region.height}h${-region.width}Z`}
            />
            <rect
              className="review-minimap__view"
              x={region.x}
              y={region.y}
              width={region.width}
              height={region.height}
            />
          </>
        )}
      </svg>
    </div>
  );
}

/** Aviso centrado mientras la foto (10–30 MB) se descarga, o si no se pudo cargar. */
export function ImageStatus({ state }: { state: Exclude<PhotoState, 'ready'> }) {
  return (
    // El fallo se anuncia en el acto; la carga, con cortesía.
    <div className="review-image-status" role={state === 'error' ? 'alert' : 'status'}>
      <p className="review-hud-box review-image-status__box">
        {state === 'loading' ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Cargando la foto a resolución completa…
          </>
        ) : (
          <>
            <AlertTriangleIcon />
            No se pudo cargar la foto. Recarga la página para intentarlo de nuevo.
          </>
        )}
      </p>
    </div>
  );
}
