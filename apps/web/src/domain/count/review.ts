import { InvalidDetectionError } from '../errors';
import type { Detection } from './detection';

/**
 * Reglas de una revisión humana frente a la propuesta del modelo:
 * - toda detección del modelo sigue presente (activa o descartada): las descartadas son negativos;
 * - las detecciones del modelo conservan `origen: "modelo"`;
 * - toda detección nueva lleva `origen: "humano"`.
 */
export function assertReviewConsistent(
  modelDetections: readonly Detection[],
  reviewedDetections: readonly Detection[],
): void {
  const reviewedById = new Map(reviewedDetections.map((d) => [d.id, d]));
  const modelIds = new Set(modelDetections.map((d) => d.id));

  for (const id of modelIds) {
    const reviewed = reviewedById.get(id);
    if (!reviewed) {
      throw new InvalidDetectionError(
        `Model detection "${id}" is missing from the review; discard it instead of removing it`,
      );
    }
    if (reviewed.origen !== 'modelo') {
      throw new InvalidDetectionError(`Model detection "${id}" must keep origen "modelo"`);
    }
  }

  for (const reviewed of reviewedDetections) {
    if (!modelIds.has(reviewed.id) && reviewed.origen !== 'humano') {
      throw new InvalidDetectionError(`New detection "${reviewed.id}" must have origen "humano"`);
    }
  }
}
