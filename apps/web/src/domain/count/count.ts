import { DomainError, InvalidValueError } from '../errors';
import type { CountId, PersonId } from './count-id';
import { assertTransition, type CountStatus } from './count-status';
import type { DetectorVersion } from './detector-version';
import type { ImageSize } from './detection';

export const SPECIES = ['bufala', 'bovino', 'otro'] as const;
export type Species = (typeof SPECIES)[number];

export interface FlightMetadata {
  readonly altitudeM?: number;
  readonly cameraAngleDeg?: number;
  readonly notes?: string;
}

/** Propuesta del modelo. Nunca es el dato oficial. */
export interface ModelProposal {
  readonly detector: DetectorVersion;
  readonly params: Readonly<Record<string, unknown>>;
  readonly image: ImageSize;
  readonly total: number;
  /** Clave en el almacenamiento de objetos del JSON de detecciones del modelo. */
  readonly resultKey: string;
}

/** Revisión humana. Su total es el dato oficial. */
export interface HumanReview {
  readonly reviewerId: PersonId;
  readonly reviewedAt: Date;
  readonly total: number;
  /** Clave en el almacenamiento de objetos del JSON de detecciones revisadas. */
  readonly resultKey: string;
}

export interface CountProps {
  readonly id: CountId;
  /** FK simbólica al potrero (fuente pendiente, ver D3). */
  readonly pastureId: string;
  readonly species: Species;
  readonly flightDate: Date;
  readonly uploadedAt: Date;
  readonly flight: FlightMetadata;
  /** Clave de la imagen original en el almacenamiento de objetos. */
  readonly originalImageKey: string;
  readonly status: CountStatus;
  readonly model?: ModelProposal;
  readonly review?: HumanReview;
  readonly errorMessage?: string;
}

export type NewCount = Omit<CountProps, 'status' | 'model' | 'review' | 'errorMessage'>;

/**
 * Conteo de animales sobre una foto (o mosaico) de un potrero en una fecha.
 * Inmutable: cada transición devuelve un nuevo `Count` y valida la máquina de estados.
 */
export class Count {
  private constructor(private readonly props: CountProps) {}

  static create(input: NewCount): Count {
    if (input.pastureId.trim() === '') throw new InvalidValueError('pastureId is required');
    if (input.originalImageKey.trim() === '') {
      throw new InvalidValueError('originalImageKey is required');
    }
    return new Count({ ...input, status: 'subido' });
  }

  /** Reconstruye un conteo ya persistido. Solo para adaptadores de infraestructura. */
  static restore(props: CountProps): Count {
    return new Count(props);
  }

  get id(): CountId {
    return this.props.id;
  }

  get status(): CountStatus {
    return this.props.status;
  }

  get originalImageKey(): string {
    return this.props.originalImageKey;
  }

  get model(): ModelProposal | undefined {
    return this.props.model;
  }

  get review(): HumanReview | undefined {
    return this.props.review;
  }

  get errorMessage(): string | undefined {
    return this.props.errorMessage;
  }

  /** Total oficial: solo existe cuando un humano revisó el conteo. */
  get officialTotal(): number | undefined {
    return this.props.review?.total;
  }

  toProps(): CountProps {
    return this.props;
  }

  startProcessing(): Count {
    return this.transition('procesando', {});
  }

  proposeDetections(model: ModelProposal): Count {
    if (!Number.isInteger(model.total) || model.total < 0) {
      throw new InvalidValueError(`Invalid model total: ${model.total}`);
    }
    return this.transition('pendiente_revision', { model });
  }

  fail(message: string): Count {
    if (message.trim() === '') throw new InvalidValueError('An error message is required');
    return this.transition('error', { errorMessage: message });
  }

  completeReview(review: HumanReview): Count {
    assertTransition(this.props.status, 'revisado');
    if (!this.props.model) throw new DomainError('Cannot review a count without a model proposal');
    if (!Number.isInteger(review.total) || review.total < 0) {
      throw new InvalidValueError(`Invalid reviewed total: ${review.total}`);
    }
    return this.transition('revisado', { review });
  }

  private transition(to: CountStatus, changes: Partial<CountProps>): Count {
    assertTransition(this.props.status, to);
    return new Count({ ...this.props, ...changes, status: to });
  }
}
