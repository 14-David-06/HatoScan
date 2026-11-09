import type { UserAccount } from './auth/user';
import type { Count } from './count/count';
import type { CountId, PersonId } from './count/count-id';
import type { Detection, ImageSize } from './count/detection';
import type { DetectorVersion } from './count/detector-version';

/** Resultado de una detección, independiente de la implementación (Claude, OpenAI, un modelo propio, ...). */
export interface DetectionOutput {
  readonly detector: DetectorVersion;
  readonly params: Readonly<Record<string, unknown>>;
  readonly image: ImageSize;
  readonly detections: readonly Detection[];
  readonly processingMs?: number;
}

export interface DetectInput {
  readonly countId: CountId;
  /** Bytes de la imagen original, a resolución completa: nunca se reduce antes de detectar. */
  readonly image: Uint8Array;
  readonly detector?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** Un método de detección que se puede elegir (Claude, OpenAI, ...). */
export interface DetectionMethod {
  /** Nombre estable, ej. `claude-vision`. */
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

/** Lo que el almacenamiento sabe de un objeto guardado. */
export interface ObjectInfo {
  readonly size: number;
  readonly contentType: string;
}

/** Petición que el navegador hace para subir un archivo directo al almacenamiento. */
export interface UploadTarget {
  readonly url: string;
  readonly method: 'PUT';
  /** Cabeceras que la petición debe llevar tal cual (van firmadas). */
  readonly headers: Readonly<Record<string, string>>;
}

/** Puerto del almacenamiento de binarios (D1: bucket S3 privado; ver ADR 0006). */
export interface ObjectStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  getReadUrl(key: string, ttlSeconds: number): Promise<string>;
  /**
   * URL temporal para subir un objeto sin pasar por la app: las fotos de 10–30 MB superan el
   * límite de cuerpo de las funciones serverless.
   */
  getUploadUrl(key: string, contentType: string, ttlSeconds: number): Promise<UploadTarget>;
  /** `undefined` si el objeto no existe. */
  stat(key: string): Promise<ObjectInfo | undefined>;
  copy(fromKey: string, toKey: string): Promise<void>;
  /** No falla si el objeto ya no existe. */
  delete(key: string): Promise<void>;
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

/** Directorio de cuentas de usuario (hoy la tabla Usuarios de Airtable). */
export interface UserDirectory {
  /** Busca por número de cédula (solo dígitos). */
  findByNationalId(nationalId: string): Promise<UserAccount | undefined>;
}

/** Verificación de contraseñas contra el hash guardado. */
export interface PasswordHasher {
  verify(password: string, passwordHash: string): Promise<boolean>;
}
