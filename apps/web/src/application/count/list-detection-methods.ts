import type { DetectionMethodCatalog, Detector } from '@/domain/index';

/** Métodos de detección que la persona puede elegir al procesar un conteo. */
export class ListDetectionMethods {
  constructor(private readonly detector: Detector) {}

  execute(): Promise<DetectionMethodCatalog> {
    return this.detector.methods();
  }
}
