import { InvalidDetectionError } from '../errors';

/** Dimensiones de la imagen original, en píxeles. */
export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Un animal detectado o marcado. Coordenadas en píxeles de la imagen original, origen
 * arriba-izquierda; para `caja`, (x, y) es la esquina superior izquierda.
 * Las descartadas se conservan: son negativos para entrenamiento.
 */
export interface Detection {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly tipo: 'punto' | 'caja';
  readonly w?: number;
  readonly h?: number;
  readonly score?: number;
  readonly origen: 'modelo' | 'humano';
  readonly estado: 'activa' | 'descartada';
}

export function countActive(detections: readonly Detection[]): number {
  return detections.filter((d) => d.estado === 'activa').length;
}

/** Valida que la detección sea coherente y caiga dentro de la imagen original. */
export function assertValidDetection(detection: Detection, image: ImageSize): void {
  const { id, x, y, tipo, w, h, score } = detection;
  const fail = (reason: string): never => {
    throw new InvalidDetectionError(`Detection "${id}": ${reason}`);
  };

  if (!Number.isFinite(x) || !Number.isFinite(y)) fail('coordinates must be finite');
  if (x < 0 || y < 0 || x > image.width || y > image.height) fail('point outside image');
  if (score !== undefined && (score < 0 || score > 1)) fail('score must be within [0, 1]');

  if (tipo === 'caja') {
    if (w === undefined || h === undefined || w <= 0 || h <= 0) {
      fail('box requires positive w and h');
    } else if (x + w > image.width || y + h > image.height) {
      fail('box outside image');
    }
  } else if (w !== undefined || h !== undefined) {
    fail('point must not have w or h');
  }
}

export function assertValidDetections(detections: readonly Detection[], image: ImageSize): void {
  const seen = new Set<string>();
  for (const detection of detections) {
    if (seen.has(detection.id)) {
      throw new InvalidDetectionError(`Duplicate detection id "${detection.id}"`);
    }
    seen.add(detection.id);
    assertValidDetection(detection, image);
  }
}
