import type { Detection, ImageSize } from '@/domain/index';

/**
 * Estado del editor de revisión. Las coordenadas son siempre píxeles de la imagen original.
 * - Una detección del modelo nunca se elimina: se descarta o se restaura (negativos de entrenamiento).
 * - Una marca humana se puede quitar, porque todavía no se ha guardado.
 */
export interface ReviewState {
  readonly detections: readonly Detection[];
  readonly history: readonly (readonly Detection[])[];
  readonly nextHumanNumber: number;
}

export type ReviewAction =
  | { readonly type: 'toggle'; readonly id: string }
  | { readonly type: 'add'; readonly x: number; readonly y: number; readonly image: ImageSize }
  | { readonly type: 'undo' }
  | { readonly type: 'reset'; readonly detections: readonly Detection[] };

export interface ReviewSummary {
  readonly model: number;
  readonly confirmed: number;
  readonly discarded: number;
  readonly added: number;
  readonly total: number;
}

export function initialReviewState(detections: readonly Detection[]): ReviewState {
  return { detections, history: [], nextHumanNumber: nextFreeHumanNumber(detections) };
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case 'toggle': {
      const target = state.detections.find((d) => d.id === action.id);
      if (!target) return state;
      const detections =
        target.origen === 'humano'
          ? state.detections.filter((d) => d.id !== action.id)
          : state.detections.map((d) =>
              d.id === action.id
                ? {
                    ...d,
                    estado: d.estado === 'activa' ? ('descartada' as const) : ('activa' as const),
                  }
                : d,
            );
      return commit(state, detections, state.nextHumanNumber);
    }
    case 'add': {
      const x = clamp(Math.round(action.x), 0, action.image.width);
      const y = clamp(Math.round(action.y), 0, action.image.height);
      const added: Detection = {
        id: `h-${state.nextHumanNumber}`,
        x,
        y,
        tipo: 'punto',
        origen: 'humano',
        estado: 'activa',
      };
      return commit(state, [...state.detections, added], state.nextHumanNumber + 1);
    }
    case 'undo': {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return { ...state, detections: previous, history: state.history.slice(0, -1) };
    }
    case 'reset':
      return initialReviewState(action.detections);
  }
}

export function summarize(detections: readonly Detection[]): ReviewSummary {
  let model = 0;
  let confirmed = 0;
  let discarded = 0;
  let added = 0;
  for (const d of detections) {
    if (d.origen === 'modelo') {
      model += 1;
      if (d.estado === 'activa') confirmed += 1;
      else discarded += 1;
    } else if (d.estado === 'activa') {
      added += 1;
    }
  }
  return { model, confirmed, discarded, added, total: confirmed + added };
}

/** Detección más cercana al punto (en píxeles de la imagen original) dentro del radio dado. */
export function hitTest(
  detections: readonly Detection[],
  x: number,
  y: number,
  radius: number,
): Detection | undefined {
  let best: Detection | undefined;
  let bestDistance = Infinity;
  for (const d of detections) {
    const distance = distanceTo(d, x, y);
    if (distance <= radius && distance < bestDistance) {
      best = d;
      bestDistance = distance;
    }
  }
  return best;
}

/** Centro de la detección: el punto mismo o el centro de la caja. */
export function centerOf(d: Detection): { x: number; y: number } {
  return d.tipo === 'caja' && d.w !== undefined && d.h !== undefined
    ? { x: d.x + d.w / 2, y: d.y + d.h / 2 }
    : { x: d.x, y: d.y };
}

function distanceTo(d: Detection, x: number, y: number): number {
  if (d.tipo === 'caja' && d.w !== undefined && d.h !== undefined) {
    const dx = Math.max(d.x - x, 0, x - (d.x + d.w));
    const dy = Math.max(d.y - y, 0, y - (d.y + d.h));
    return Math.hypot(dx, dy);
  }
  return Math.hypot(d.x - x, d.y - y);
}

function commit(state: ReviewState, detections: readonly Detection[], nextHumanNumber: number) {
  return { detections, history: [...state.history, state.detections], nextHumanNumber };
}

function nextFreeHumanNumber(detections: readonly Detection[]): number {
  let max = 0;
  for (const d of detections) {
    const match = /^h-(\d+)$/.exec(d.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
