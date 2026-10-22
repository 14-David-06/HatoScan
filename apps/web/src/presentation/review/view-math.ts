import type { ImageSize } from '@/domain/index';

/**
 * Geometría del visor de revisión. La vista lleva la imagen original al visor con
 * `pantalla = t + escala · imagen`; una escala de 1 es un píxel de imagen por píxel de pantalla.
 */
export interface View {
  readonly scale: number;
  readonly tx: number;
  readonly ty: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const MAX_SCALE = 8;

/** A partir de esta escala cada píxel de la foto se ve como un bloque nítido, sin suavizado. */
export const PIXELATED_FROM_SCALE = 2;

/** Vista que muestra la imagen completa y centrada. */
export function fitView(viewport: ImageSize, image: ImageSize): View {
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height);
  return {
    scale,
    tx: (viewport.width - image.width * scale) / 2,
    ty: (viewport.height - image.height * scale) / 2,
  };
}

/** Escala mínima: la mitad del ajuste, para ver la foto entera con margen. */
export function minScale(viewport: ImageSize, image: ImageSize): number {
  return fitView(viewport, image).scale / 2;
}

export function clampScale(scale: number, min: number, max: number = MAX_SCALE): number {
  return Math.min(Math.max(scale, min), max);
}

/**
 * Escala tras un cambio de zoom. El mínimo nunca empuja en contra del gesto: si la vista ya está
 * por debajo (tamaño real de una foto pequeña), alejar la deja donde está en vez de acercarla.
 * `floor` deja bajar del mínimo a propósito, como «Tamaño real» (escala 1).
 */
export function nextScale(
  current: number,
  requested: number,
  min: number,
  floor: number = Number.POSITIVE_INFINITY,
): number {
  return clampScale(requested, Math.min(min, current, floor));
}

/** Cambia la escala dejando fijo en pantalla el punto `anchor` del visor. */
export function zoomAround(view: View, scale: number, anchor: Point): View {
  const ratio = scale / view.scale;
  return {
    scale,
    tx: anchor.x - (anchor.x - view.tx) * ratio,
    ty: anchor.y - (anchor.y - view.ty) * ratio,
  };
}

/** Punto del visor (relativo a su esquina) → píxeles de la imagen original. */
export function toImagePoint(view: View, point: Point): Point {
  return { x: (point.x - view.tx) / view.scale, y: (point.y - view.ty) / view.scale };
}

export function isInsideImage(point: Point, image: ImageSize): boolean {
  return point.x >= 0 && point.y >= 0 && point.x <= image.width && point.y <= image.height;
}

/** Misma escala, con el punto de la imagen en el centro del visor. */
export function centerOn(view: View, viewport: ImageSize, point: Point): View {
  return {
    scale: view.scale,
    tx: viewport.width / 2 - point.x * view.scale,
    ty: viewport.height / 2 - point.y * view.scale,
  };
}

/**
 * Pellizco con dos dedos: la escala sigue la distancia entre dedos y el punto de la imagen que
 * estaba bajo el punto medio inicial sigue al punto medio actual.
 */
export function pinchView(
  start: View,
  startMid: Point,
  startDistance: number,
  mid: Point,
  distance: number,
  min: number,
): View {
  const scale = clampScale(start.scale * (distance / startDistance), min);
  const anchor = toImagePoint(start, startMid);
  return { scale, tx: mid.x - anchor.x * scale, ty: mid.y - anchor.y * scale };
}

/** Parte de la imagen que se ve en el visor, en píxeles originales; `null` si no se ve nada. */
export function visibleRegion(view: View, viewport: ImageSize, image: ImageSize): Region | null {
  if (view.scale <= 0) return null;
  const x0 = Math.max(0, -view.tx / view.scale);
  const y0 = Math.max(0, -view.ty / view.scale);
  const x1 = Math.min(image.width, (viewport.width - view.tx) / view.scale);
  const y1 = Math.min(image.height, (viewport.height - view.ty) / view.scale);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Radio de las marcas en píxeles originales: ~10 px, pero nunca menos de 6 px en pantalla.
 * La hoja de estilos repite esta fórmula para dibujar los círculos sin volver a renderizarlos.
 */
export function markRadius(scale: number): number {
  return Math.max(10, 6 / Math.max(scale, 1e-6));
}

/** Radio de acierto de un clic: la marca más 3 px de pantalla de tolerancia. */
export function hitRadius(scale: number): number {
  return markRadius(scale) + 3 / Math.max(scale, 1e-6);
}
