import {
  toDetectorVersion,
  type DetectInput,
  type Detection,
  type DetectionMethodCatalog,
  type DetectionOutput,
  type Detector,
} from '@/domain/index';
import {
  DetectorError,
  InvalidDetectorParamsError,
  type DetectionMethodAdapter,
  type RawDetection,
} from './method';
import { paramsHash } from './params-hash';

export interface InProcessDetectorOptions {
  /** Métodos en el orden en que se ofrecen. Los no disponibles se listan pero no se ejecutan. */
  readonly methods: readonly DetectionMethodAdapter[];
  readonly defaultMethod: string;
  /**
   * Tiempo máximo de una detección. Por debajo del `maxDuration` de la ruta de procesamiento, para
   * alcanzar a dejar el conteo en `error` antes de que la plataforma corte la función.
   */
  readonly timeoutMs: number;
}

/**
 * Implementación del puerto `Detector` que corre en el servidor de la app (ADR 0007): elige el
 * método por nombre, valida sus parámetros y traduce su salida al dominio. La inferencia la hacen
 * los modelos de IA por API; aquí solo se recorta la foto y se reúnen las respuestas.
 */
export class InProcessDetector implements Detector {
  private readonly byName: ReadonlyMap<string, DetectionMethodAdapter>;

  constructor(private readonly options: InProcessDetectorOptions) {
    this.byName = new Map(options.methods.map((m) => [m.name, m]));
    if (!this.byName.has(options.defaultMethod)) {
      throw new Error(
        `Default detection method "${options.defaultMethod}" is not among the enabled methods`,
      );
    }
  }

  methods(): Promise<DetectionMethodCatalog> {
    return Promise.resolve({
      defaultMethod: this.options.defaultMethod,
      methods: this.options.methods.map(({ name, version, label, description, available }) => ({
        name,
        version,
        label,
        description,
        available,
      })),
    });
  }

  async detect(input: DetectInput): Promise<DetectionOutput> {
    const name = input.detector ?? this.options.defaultMethod;
    const method = this.byName.get(name);
    if (!method) throw new InvalidDetectorParamsError(`Unknown detector "${name}"`);
    if (!method.available) {
      throw new InvalidDetectorParamsError(`Detector "${name}" is not available`);
    }
    const params = method.resolveParams(input.params);

    const { timeoutMs } = this.options;
    const signal = AbortSignal.timeout(timeoutMs);
    const started = performance.now();
    let raw;
    try {
      raw = await method.detect(input.image, params, signal);
    } catch (error) {
      if (signal.aborted) {
        throw new DetectorError(
          `Detection did not finish within ${Math.round(timeoutMs / 1000)} s (DETECTOR_TIMEOUT_MS)`,
          { cause: error },
        );
      }
      throw error;
    }
    const processingMs = Math.round(performance.now() - started);

    return {
      detector: toDetectorVersion(`${method.name}@${method.version}`, paramsHash(params)),
      params,
      image: { width: raw.width, height: raw.height },
      detections: raw.detections.map(toModelDetection),
      processingMs,
    };
  }
}

function toModelDetection(raw: RawDetection, index: number): Detection {
  return {
    id: `m-${index + 1}`,
    x: raw.x,
    y: raw.y,
    tipo: raw.kind,
    ...(raw.w !== undefined && { w: raw.w }),
    ...(raw.h !== undefined && { h: raw.h }),
    ...(raw.score !== undefined && { score: raw.score }),
    origen: 'modelo',
    estado: 'activa',
  };
}
