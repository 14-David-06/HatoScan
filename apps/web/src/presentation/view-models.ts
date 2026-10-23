import type { CountDetail } from '@/application/count/get-count-detail';
import type {
  Count,
  DetectionMethodCatalog,
  CountStatus,
  Detection,
  FlightMetadata,
  ImageSize,
  Species,
  User,
} from '@/domain/index';
import { canReview } from '@/domain/index';

export const SPECIES_LABELS: Readonly<Record<Species, string>> = {
  bufala: 'Búfala',
  bovino: 'Bovino',
  otro: 'Otro',
};

export const STATUS_LABELS: Readonly<Record<CountStatus, string>> = {
  subido: 'Subido',
  procesando: 'Procesando',
  pendiente_revision: 'Pendiente de revisión',
  revisado: 'Revisado',
  error: 'Error',
};

/** Métodos de detección para los selectores; `null` si el servicio no respondió. */
export type DetectionMethodsView = DetectionMethodCatalog | null;

/** Fila de la lista de conteos. Solo datos serializables. */
export interface CountSummaryView {
  readonly id: string;
  /** Vacía en conteos anteriores al campo Finca. */
  readonly farm: string;
  readonly pastureId: string;
  readonly species: Species;
  /** `AAAA-MM-DD` */
  readonly flightDate: string;
  readonly uploadedAt: string;
  readonly status: CountStatus;
  readonly modelTotal?: number;
  readonly reviewedTotal?: number;
}

export interface CountDetailView extends CountSummaryView {
  readonly imageUrl: string;
  readonly flight: FlightMetadata;
  readonly errorMessage?: string;
  readonly detectorVersion?: string;
  readonly image?: ImageSize;
  readonly modelDetections?: readonly Detection[];
  readonly reviewedDetections?: readonly Detection[];
  readonly reviewerId?: string;
  readonly reviewedAt?: string;
}

export function toCountSummary(count: Count): CountSummaryView {
  return {
    id: count.id,
    farm: count.farm,
    pastureId: count.pastureId,
    species: count.species,
    flightDate: count.flightDate.toISOString().slice(0, 10),
    uploadedAt: count.uploadedAt.toISOString(),
    status: count.status,
    ...(count.model && { modelTotal: count.model.total }),
    ...(count.review && { reviewedTotal: count.review.total }),
  };
}

export function toCountDetail(detail: CountDetail): CountDetailView {
  const { count, imageUrl, model, review } = detail;
  return {
    ...toCountSummary(count),
    imageUrl,
    flight: { ...count.flight },
    ...(count.errorMessage !== undefined && { errorMessage: count.errorMessage }),
    ...(model && {
      detectorVersion: model.detector.version,
      image: model.image,
      modelDetections: model.detections,
    }),
    ...(review && {
      reviewedDetections: review.detections,
      reviewerId: review.reviewerId,
      reviewedAt: review.reviewedAt.toISOString(),
    }),
  };
}

/** Usuario de la sesión, tal como lo ven las pantallas. Solo datos serializables. */
export interface SessionUserView {
  readonly id: string;
  readonly name: string;
  readonly canReview: boolean;
}

/** Quien confirmaría una revisión. */
export interface ReviewerView {
  readonly id: string;
  readonly name: string;
}

/** Estado del formulario de ingreso entre envíos (server action). */
export interface LoginState {
  readonly error?: string;
  readonly nationalId?: string;
}

export function toSessionUser(user: User): SessionUserView {
  return { id: user.id, name: user.name, canReview: canReview(user) };
}
