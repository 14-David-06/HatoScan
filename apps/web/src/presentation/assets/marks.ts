/** Caja de un animal: centro (`x`, `y`) y tamaño (`w`, `h`) en píxeles de la imagen. */
export interface MarkBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Animales de una imagen de la interfaz, en píxeles de la imagen (origen arriba a la izquierda).
 * Los escribe `scripts/imagery.mjs` y los revisa una persona.
 */
export interface ImageMarks {
  readonly width: number;
  readonly height: number;
  /** De arriba abajo. */
  readonly animals: readonly MarkBox[];
}

/** El animal cuyo centro queda más cerca de un punto: para nombrar uno sin depender del orden. */
export function nearestMark(marks: ImageMarks, x: number, y: number): MarkBox {
  let best = marks.animals[0];
  if (!best) throw new Error('The image has no marks');
  for (const box of marks.animals) {
    if (Math.hypot(box.x - x, box.y - y) < Math.hypot(best.x - x, best.y - y)) best = box;
  }
  return best;
}

/** Contorno de esquinas del visor alrededor de una caja, con un margen para no tapar al animal. */
export function cornersPath(box: MarkBox, pad: number): string {
  const x0 = box.x - box.w / 2 - pad;
  const x1 = box.x + box.w / 2 + pad;
  const y0 = box.y - box.h / 2 - pad;
  const y1 = box.y + box.h / 2 + pad;
  const l = Math.round(Math.min(x1 - x0, y1 - y0) * 0.32);
  return [
    `M${x0} ${y0 + l}V${y0}H${x0 + l}`,
    `M${x1 - l} ${y0}H${x1}V${y0 + l}`,
    `M${x1} ${y1 - l}V${y1}H${x1 - l}`,
    `M${x0 + l} ${y1}H${x0}V${y1 - l}`,
  ].join('');
}
