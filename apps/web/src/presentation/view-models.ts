import type { CountDetail } from '@/application/count/get-count-detail';
import type {
  Count,
  DetectionMethodCatalog,
  CountStatus,
  Detection,
  FlightMetadata,
  ImageSize,
  Species,
} from '@/domain/index';

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
