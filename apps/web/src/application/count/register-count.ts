import {
  Count,
  InvalidValueError,
  type Clock,
  type CountIdGenerator,
  type CountRepository,
  type FlightMetadata,
  type ObjectStorage,
  type Species,
} from '@/domain/index';
import { assertImageSize, IMAGE_EXTENSIONS, isUploadKey } from './create-image-upload';

export interface RegisterCountDeps {
  readonly counts: CountRepository;
  readonly ids: CountIdGenerator;
  readonly storage: ObjectStorage;
  readonly clock: Clock;
}

export interface RegisterCountInput {
  readonly farm: string;
  readonly pastureId: string;
  readonly species: Species;
  readonly flightDate: Date;
  readonly flight: FlightMetadata;
  /** Clave que devolvió `CreateImageUpload`; el navegador ya subió la foto ahí. */
  readonly uploadKey: string;
}

/**
 * Registra un conteo nuevo con la foto que el navegador subió directo al almacenamiento: la mueve a
 * `counts/{id}/original.{ext}` sin tocar sus bytes y deja el conteo en `subido`.
 */
export class RegisterCount {
  constructor(private readonly deps: RegisterCountDeps) {}

  async execute(input: RegisterCountInput): Promise<Count> {
    const { counts, ids, storage, clock } = this.deps;

    if (!isUploadKey(input.uploadKey)) {
      throw new InvalidValueError(`Invalid upload key: ${input.uploadKey}`);
    }
    if (Number.isNaN(input.flightDate.getTime()))
      throw new InvalidValueError('Invalid flight date');

    const uploaded = await storage.stat(input.uploadKey);
    if (!uploaded) throw new InvalidValueError('The image was not uploaded');
    const extension = IMAGE_EXTENSIONS[uploaded.contentType];
    if (!extension || !input.uploadKey.endsWith(`.${extension}`)) {
      throw new InvalidValueError(`Unsupported image type: ${uploaded.contentType}`);
    }
    try {
      assertImageSize(uploaded.size);
    } catch (error) {
      await storage.delete(input.uploadKey);
      throw error;
    }

    const id = await ids.next();
    const originalImageKey = `counts/${id}/original.${extension}`;
    // Validar el conteo antes de mover el binario.
    const count = Count.create({
      id,
      farm: input.farm.trim(),
      pastureId: input.pastureId.trim(),
      species: input.species,
      flightDate: input.flightDate,
      uploadedAt: clock.now(),
      flight: input.flight,
      originalImageKey,
    });

    await storage.copy(input.uploadKey, originalImageKey);
    await counts.save(count);
    // Si falla, la regla de ciclo de vida del bucket borra la subida en 24 h.
    await storage.delete(input.uploadKey).catch(() => undefined);
    return count;
  }
}
