import type { MarkBox } from '../assets/marks';

/**
 * Guion de la revisión animada de la portada, en milisegundos desde que arranca. Lo comparten el
 * HUD (que cuenta con `frameAt`) y la hoja de estilos (que recibe cada momento como `--at`), así
 * el número y las marcas van sincronizados.
 *
 *   barrido ─ cada propuesta del modelo aparece cuando la línea pasa por su centro
 *   revisión ─ la persona descarta el error del modelo y añade, una a una, las que faltaron
 *   listo ─ el total confirmado
 */
export const SCAN_START_MS = 400;
export const SCAN_MS = 2800;
export const DISCARD_AT_MS = SCAN_START_MS + SCAN_MS + 500;
const FIRST_ADD_MS = DISCARD_AT_MS + 650;
const ADD_GAP_MS = 450;
const SETTLE_MS = 650;

export interface HeroScript {
  readonly imageHeight: number;
  /** Lo que propone el modelo, incluido su error (`falsePositive`). */
  readonly proposed: readonly MarkBox[];
  /** La propuesta que no es un animal: la persona la descarta. */
  readonly falsePositive: MarkBox;
  /** Animales que el modelo no vio: la persona los añade en este orden. */
  readonly missed: readonly MarkBox[];
}

export type HeroStage = 'scan' | 'review' | 'done';

export interface HeroFrame {
  readonly stage: HeroStage;
  /** Lo que marca el HUD: propuestas visibles, menos la descartada, más las añadidas. */
  readonly count: number;
}

/** Cuándo aparece una propuesta: cuando la línea de barrido llega a su centro. */
export function appearAtMs(box: MarkBox, imageHeight: number): number {
  return Math.round(SCAN_START_MS + (SCAN_MS * box.y) / imageHeight);
}

export function addAtMs(index: number): number {
  return FIRST_ADD_MS + index * ADD_GAP_MS;
}

export function doneAtMs(script: HeroScript): number {
  return addAtMs(Math.max(0, script.missed.length - 1)) + SETTLE_MS;
}

/** Total confirmado al final: propuestas sin el error, más las añadidas. */
export function confirmedTotal(script: HeroScript): number {
  return script.proposed.length - 1 + script.missed.length;
}

export function frameAt(elapsedMs: number, script: HeroScript): HeroFrame {
  if (elapsedMs >= doneAtMs(script)) return { stage: 'done', count: confirmedTotal(script) };
  const shown = script.proposed.filter(
    (box) => appearAtMs(box, script.imageHeight) <= elapsedMs,
  ).length;
  if (elapsedMs < DISCARD_AT_MS) return { stage: 'scan', count: shown };
  const added = script.missed.filter((_, i) => addAtMs(i) <= elapsedMs).length;
  return { stage: 'review', count: shown - 1 + added };
}
