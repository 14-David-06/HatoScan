import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectInfo, ObjectStorage, UploadTarget } from '@/domain/index';

export interface S3ObjectStorageOptions {
  readonly bucket: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/**
 * Bucket S3 privado (D1, ADR 0006). Nada es público: el navegador y el detector leen y suben con
 * URLs firmadas que caducan. El cifrado en reposo es el predeterminado del bucket (SSE-S3).
 */
export class S3ObjectStorage implements ObjectStorage {
  private readonly bucket: string;

  constructor(
    options: S3ObjectStorageOptions,
    private readonly client: S3Client = new S3Client({
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      // Sin esto, el SDK firma una suma de comprobación que el navegador no envía al subir con la
      // URL firmada, y S3 rechaza la subida.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  ) {
    this.bucket = options.bucket;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Uint8Array> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) throw new Error(`Object has no body: ${key}`);
    return response.Body.transformToByteArray();
  }

  getReadUrl(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttlSeconds,
    });
  }

  async getUploadUrl(key: string, contentType: string, ttlSeconds: number): Promise<UploadTarget> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      // La URL solo vale con ese tipo: S3 lo guarda y el registro del conteo lo vuelve a comprobar.
      { expiresIn: ttlSeconds, signableHeaders: new Set(['content-type']) },
    );
    return { url, method: 'PUT', headers: { 'content-type': contentType } };
  }

  async stat(key: string): Promise<ObjectInfo | undefined> {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        size: head.ContentLength ?? 0,
        contentType: head.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        return undefined;
      }
      throw error;
    }
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    // Copia dentro del bucket: los bytes no pasan por la app. Conserva el tipo del original.
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: toKey,
        CopySource: `${this.bucket}/${fromKey}`,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
