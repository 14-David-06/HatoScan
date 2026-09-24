import type { Detection as DetectionContract } from '@hatoscan/contracts';
import type { Detection } from '@/domain/index';

/** Zod tipa los opcionales como `T | undefined`; el dominio no admite `undefined` explícito. */
export function toDomainDetection(d: DetectionContract): Detection {
  return {
    id: d.id,
    x: d.x,
    y: d.y,
    tipo: d.tipo,
    origen: d.origen,
    estado: d.estado,
    ...(d.w !== undefined && { w: d.w }),
    ...(d.h !== undefined && { h: d.h }),
    ...(d.score !== undefined && { score: d.score }),
  };
}
