import type { Count } from './count/count';
import type { CountId, PersonId } from './count/count-id';
import type { Detection, ImageSize } from './count/detection';
import type { DetectorVersion } from './count/detector-version';

/** Resultado de una detección, independiente de la implementación (visión clásica, YOLO, ...). */
export interface DetectionOutput {
  readonly detector: DetectorVersion;
  readonly params: Readonly<Record<string, unknown>>;
  readonly image: ImageSize;
  readonly detections: readonly Detection[];
  readonly processingMs?: number;
}

export interface DetectInput {
  readonly countId: CountId;
  /** URL de lectura temporal de la imagen original, a resolución completa. */
  readonly imageUrl: string;
  readonly detector?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** Un método de detección que ofrece el servicio (visión clásica, YOLO, ...). */
export interface DetectionMethod {
  /** Nombre estable, ej. `classic-cv`. */
  readonly name: string;
  readonly version: string;
  readonly label: string;
  readonly description: string;
  /** `false` si está declarado pero todavía no se puede ejecutar. */
  readonly available: boolean;
}

export interface DetectionMethodCatalog {
  readonly defaultMethod: string;
  readonly methods: readonly DetectionMethod[];
}

/** Puerto del detector. El dominio no sabe qué modelo hay detrás. */
export interface Detector {
  detect(input: DetectInput): Promise<DetectionOutput>;
  methods(): Promise<DetectionMethodCatalog>;
}

/** Puerto del almacenamiento de binarios (decisión D1 pendiente: Pinata privado o GCS). */
export interface ObjectStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  getReadUrl(key: string, ttlSeconds: number): Promise<string>;
}

export interface ReviewRecord {
  readonly countId: CountId;
  readonly reviewerId: PersonId;
  readonly reviewedAt: Date;
  readonly sourceDetectorVersion: string;
  readonly image: ImageSize;
  readonly detections: readonly Detection[];
}

/** Persiste los JSON de detecciones (modelo y revisado). Devuelve la clave de cada uno. */
export interface DetectionResultStore {
  saveModelResult(countId: CountId, output: DetectionOutput): Promise<string>;
  loadModelResult(key: string): Promise<DetectionOutput>;
  saveReview(review: ReviewRecord): Promise<string>;
  loadReview(key: string): Promise<ReviewRecord>;
}

/** Registro de conteos (Airtable, decisión D2 pendiente). */
export interface CountRepository {
  findById(id: CountId): Promise<Count | undefined>;
  /** Conteos más recientes primero (por fecha de carga). */
  list(): Promise<readonly Count[]>;
  save(count: Count): Promise<void>;
}

/** Reserva el siguiente `SIRIUS-CONTEO-XXXX`. */
export interface CountIdGenerator {
  next(): Promise<CountId>;
}

export interface Clock {
  now(): Date;
}
