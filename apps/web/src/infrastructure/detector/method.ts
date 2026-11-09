/**
 * Contrato interno de un método de detección (Claude, OpenAI y, más adelante, un modelo propio).
 * Cada método vive en su propio archivo; `InProcessDetector` los expone al dominio a través del
 * puerto `Detector`.
 */

/** Fallo al detectar. Nunca se oculta: el conteo queda en `error` con este mensaje. */
export class DetectorError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DetectorError';
  }
}

/** Método desconocido, no disponible o con parámetros no válidos. */
export class InvalidDetectorParamsError extends DetectorError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidDetectorParamsError';
  }
}

/**
 * Detección en píxeles de la imagen original, origen arriba-izquierda (con la orientación EXIF ya
 * aplicada, igual que el navegador). Para `caja`, (x, y) es la esquina superior izquierda.
 */
export interface RawDetection {
  readonly x: number;
  readonly y: number;
  readonly kind: 'punto' | 'caja';
  readonly w?: number;
  readonly h?: number;
  readonly score?: number;
}

export interface RawDetectionOutput {
  readonly width: number;
  readonly height: number;
  readonly detections: readonly RawDetection[];
}

export type DetectionParams = Readonly<Record<string, unknown>>;

export interface DetectionMethodAdapter {
  /** Nombre estable, ej. `claude-vision`. */
  readonly name: string;
  /** Versión semántica `MAJOR.MINOR.PATCH`. Súbela cuando cambie lo que el método propone. */
  readonly version: string;
  /** Nombre corto para la UI (en español). */
  readonly label: string;
  /** Para qué sirve y cuándo elegirlo (en español). */
  readonly description: string;
  /** `false` si está declarado pero no se puede ejecutar (ej. falta la llave de su API). */
  readonly available: boolean;
  /**
   * Valida los parámetros y devuelve el conjunto completo, con valores por defecto: es lo que se
   * guarda y se resume en el hash. Lanza `InvalidDetectorParamsError`.
   */
  resolveParams(params: DetectionParams | undefined): DetectionParams;
  /** Detecta sobre la imagen a resolución completa. Nunca reducir la resolución. */
  detect(
    image: Uint8Array,
    params: DetectionParams,
    signal: AbortSignal,
  ): Promise<RawDetectionOutput>;
}
