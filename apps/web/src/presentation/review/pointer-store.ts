import type { Point } from './view-math';

/**
 * Posición del puntero sobre la foto, en píxeles originales redondeados (`null` fuera de la imagen).
 * Vive fuera del estado de React: solo la lectura de coordenadas y el resalte de la marca bajo el
 * cursor se suscriben, así mover el ratón no vuelve a renderizar el editor ni las marcas.
 */
export interface PointerStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly get: () => Point | null;
  readonly set: (point: Point | null) => void;
}

export function createPointerStore(): PointerStore {
  let current: Point | null = null;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => current,
    set(point) {
      const next = point && { x: Math.round(point.x), y: Math.round(point.y) };
      if (next?.x === current?.x && next?.y === current?.y) return;
      current = next;
      for (const listener of listeners) listener();
    },
  };
}
