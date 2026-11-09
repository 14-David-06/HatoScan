import { InvalidValueError, type ObjectStorage, type UploadTarget } from '@/domain/index';

/** Formatos aceptados para la imagen original. Se guarda tal cual: nunca se reescala. */
export const IMAGE_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/tiff': 'tif',
};

/** Fotos de dron de 10–30 MB; margen para mosaicos. La detección lee la foto entera en memoria. */
export const MAX_IMAGE_BYTES = 80 * 1024 * 1024;

/** Las subidas sin conteo viven aquí hasta registrarlo; el bucket las borra a las 24 h. */
const UPLOAD_KEY_PATTERN = /^uploads\/[0-9a-f-]{36}\.(jpg|png|tif)$/;

export function isUploadKey(key: string): boolean {
  return UPLOAD_KEY_PATTERN.test(key);
}

export interface CreateImageUploadDeps {
  readonly storage: ObjectStorage;
  /** Vigencia de la URL de subida, en segundos. */
  readonly ttlSeconds: number;
  readonly newUploadId?: () => string;
}

export interface CreateImageUploadInput {
  readonly contentType: string;
  /** Tamaño que declara el navegador. Se vuelve a comprobar con el objeto ya subido. */
  readonly size: number;
}

export interface ImageUpload extends UploadTarget {
  /** Se manda al registrar el conteo. */
  readonly uploadKey: string;
}

/**
 * Prepara la subida directa de la foto original al almacenamiento. El navegador la sube con la URL
 * firmada y luego registra el conteo con `uploadKey`.
 */
export class CreateImageUpload {
  private readonly newUploadId: () => string;

  constructor(private readonly deps: CreateImageUploadDeps) {
    this.newUploadId = deps.newUploadId ?? (() => crypto.randomUUID());
  }

  async execute(input: CreateImageUploadInput): Promise<ImageUpload> {
    const extension = IMAGE_EXTENSIONS[input.contentType];
    if (!extension) throw new InvalidValueError(`Unsupported image type: ${input.contentType}`);
    assertImageSize(input.size);

    const uploadKey = `uploads/${this.newUploadId()}.${extension}`;
    const target = await this.deps.storage.getUploadUrl(
      uploadKey,
      input.contentType,
      this.deps.ttlSeconds,
    );
    return { uploadKey, ...target };
  }
}

export function assertImageSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) throw new InvalidValueError('Image is empty');
  if (size > MAX_IMAGE_BYTES) {
    throw new InvalidValueError(`Image exceeds ${MAX_IMAGE_BYTES / 1024 / 1024} MB`);
  }
}
