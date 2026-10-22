import type { Detection } from '@/domain/index';

/**
 * Clave del editor de revisión: cambia cuando cambia lo que se revisa, no solo el estado. «Volver a
 * detectar» pasa por procesando y vuelve a pendiente_revision en una sola petición; con el estado
 * como única clave, React conservaría las marcas de la propuesta anterior sobre la nueva.
 */
export function reviewKey(input: {
  readonly status: string;
  readonly detectorVersion?: string | undefined;
  readonly detections: readonly Detection[];
}): string {
  return `${input.status}:${input.detectorVersion ?? ''}:${detectionsSignature(input.detections)}`;
}

/** Huella barata y determinista (FNV-1a de 32 bits) de las detecciones: cantidad, id y posición. */
export function detectionsSignature(detections: readonly Detection[]): string {
  let hash = 0x811c9dc5;
  const feed = (text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
  };
  feed(String(detections.length));
  for (const d of detections) feed(`|${d.id}:${d.x}:${d.y}:${d.estado}`);
  return `${detections.length}-${(hash >>> 0).toString(36)}`;
}
