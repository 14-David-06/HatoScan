'use client';

import { memo, useSyncExternalStore } from 'react';
import type { Detection, ImageSize } from '@/domain/index';
import type { PointerStore } from './pointer-store';
import { hitTest } from './review-state';
import { hitRadius } from './view-math';

/**
 * Longitud nominal del trazo: el discontinuo de una descartada se define en esta unidad, así
 * tiene siempre los mismos segmentos sea cual sea el zoom y puede transicionar desde el continuo.
 */
const MARK_PATH_LENGTH = 24;

interface MarksLayerProps {
  readonly detections: readonly Detection[];
  readonly image: ImageSize;
  /** IDs presentes al abrir el editor: las marcas humanas nuevas hacen un «ping» al aparecer. */
  readonly initialIds: ReadonlySet<string>;
  readonly hidden: boolean;
}

/**
 * Capa de marcas. El radio y el grosor dependen del zoom, pero no se pasan como props: la hoja de
 * estilos los calcula a partir de `--review-s`, así acercar o mover la vista no renderiza las marcas.
 */
export const MarksLayer = memo(function MarksLayer({
  detections,
  image,
  initialIds,
  hidden,
}: MarksLayerProps) {
  return (
    <svg
      className="review-marks"
      data-hidden={hidden || undefined}
      viewBox={`0 0 ${image.width} ${image.height}`}
      width={image.width}
      height={image.height}
      aria-hidden="true"
    >
      {detections.map((d) => (
        <Mark key={d.id} detection={d} fresh={d.origen === 'humano' && !initialIds.has(d.id)} />
      ))}
    </svg>
  );
});

const Mark = memo(function Mark({ detection: d, fresh }: { detection: Detection; fresh: boolean }) {
  const variant =
    d.estado === 'descartada' ? 'discarded' : d.origen === 'humano' ? 'human' : 'model';
  const className = `review-mark review-mark--${variant}`;
  if (d.tipo === 'caja' && d.w !== undefined && d.h !== undefined) {
    return (
      <rect
        x={d.x}
        y={d.y}
        width={d.w}
        height={d.h}
        className={className}
        pathLength={MARK_PATH_LENGTH}
      />
    );
  }
  return (
    <>
      <circle cx={d.x} cy={d.y} className={className} pathLength={MARK_PATH_LENGTH} />
      {fresh && <circle cx={d.x} cy={d.y} className="review-ping" />}
    </>
  );
});

/**
 * Anillo sobre la marca que un clic cambiaría. Es el único elemento de la foto que sigue al
 * puntero: se suscribe a la posición sin pasar por el estado del editor.
 */
export function HoverRing({
  store,
  detections,
  image,
  scale,
}: {
  store: PointerStore;
  detections: readonly Detection[];
  image: ImageSize;
  scale: number;
}) {
  const point = useSyncExternalStore(store.subscribe, store.get, () => null);
  const hit = point && hitTest(detections, point.x, point.y, hitRadius(scale));
  // Separación del anillo respecto a la caja: 4 px de pantalla.
  const pad = 4 / Math.max(scale, 1e-6);
  return (
    <svg
      className="review-hover"
      viewBox={`0 0 ${image.width} ${image.height}`}
      width={image.width}
      height={image.height}
      aria-hidden="true"
    >
      {hit &&
        // Dos trazos (halo oscuro y anillo claro) para que se vea sobre pasto y sobre suelo.
        ['review-hover__halo', 'review-hover__ring'].map((className) =>
          hit.tipo === 'caja' && hit.w !== undefined && hit.h !== undefined ? (
            <rect
              key={className}
              className={className}
              x={hit.x - pad}
              y={hit.y - pad}
              width={hit.w + pad * 2}
              height={hit.h + pad * 2}
            />
          ) : (
            <circle key={className} className={className} cx={hit.x} cy={hit.y} />
          ),
        )}
    </svg>
  );
}
