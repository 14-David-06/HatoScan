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

/** Formatos aceptados para la imagen original. Se guarda tal cual: nunca se reescala. */
const IMAGE_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/tiff': 'tif',
};

export const ACCEPTED_IMAGE_TYPES = Object.keys(IMAGE_EXTENSIONS);

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
  readonly image: { readonly bytes: Uint8Array; readonly contentType: string };
}

/** Registra un conteo nuevo: guarda la imagen original y deja el conteo en `subido`. */
export class RegisterCount {
  constructor(private readonly deps: RegisterCountDeps) {}

  async execute(input: RegisterCountInput): Promise<Count> {
    const { counts, ids, storage, clock } = this.deps;

    const extension = IMAGE_EXTENSIONS[input.image.contentType];
    if (!extension) {
      throw new InvalidValueError(`Unsupported image type: ${input.image.contentType}`);
    }
    if (input.image.bytes.byteLength === 0) throw new InvalidValueError('Image is empty');
    if (Number.isNaN(input.flightDate.getTime()))
      throw new InvalidValueError('Invalid flight date');

    const id = await ids.next();
    const originalImageKey = `counts/${id}/original.${extension}`;
    // Validar el conteo antes de escribir el binario.
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

    await storage.put(originalImageKey, input.image.bytes, input.image.contentType);
    await counts.save(count);
    return count;
  }
}
