import { createHmac, timingSafeEqual } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { ObjectInfo, ObjectStorage, UploadTarget } from '@/domain/index';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  json: 'application/json',
};

const KEY_PATTERN = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

export interface LocalFsObjectStorageOptions {
  /** Carpeta raíz donde se guardan los objetos. */
  readonly rootDir: string;
  /** URL pública de la app, sin barra final; las URLs de lectura apuntan a `/api/files`. */
  readonly publicBaseUrl: string;
  /** Secreto para firmar las URLs de lectura (HMAC-SHA256). */
  readonly signingSecret: string;
  readonly now?: () => Date;
}

export interface SignedRequest {
  readonly key: string;
  readonly expires: string | null;
  readonly signature: string | null;
}

/** Una URL de lectura no sirve para escribir, ni al revés. */
type Purpose = 'read' | 'write';

/**
 * Almacenamiento en disco para desarrollo local (en producción, S3; ver ADR 0006). Las URLs de
 * lectura y de subida caducan y van firmadas, como las de S3, y las sirve `/api/files`.
 */
export class LocalFsObjectStorage implements ObjectStorage {
  private readonly rootDir: string;
  private readonly now: () => Date;

  constructor(private readonly options: LocalFsObjectStorageOptions) {
    this.rootDir = resolve(options.rootDir);
    this.now = options.now ?? (() => new Date());
  }

  /** El tipo se deduce de la extensión de la clave al leer. */
  async put(key: string, body: Uint8Array): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, body);
    await rename(temporary, path);
  }

  async get(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.pathFor(key)));
  }

  getReadUrl(key: string, ttlSeconds: number): Promise<string> {
    return Promise.resolve(this.signedUrl('read', key, ttlSeconds));
  }

  getUploadUrl(key: string, contentType: string, ttlSeconds: number): Promise<UploadTarget> {
    return Promise.resolve({
      url: this.signedUrl('write', key, ttlSeconds),
      method: 'PUT',
      headers: { 'content-type': contentType },
    });
  }

  async stat(key: string): Promise<ObjectInfo | undefined> {
    try {
      const info = await stat(this.pathFor(key));
      return { size: info.size, contentType: contentTypeOf(key) };
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    const to = this.pathFor(toKey);
    await mkdir(dirname(to), { recursive: true });
    await copyFile(this.pathFor(fromKey), to);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  /** Devuelve el objeto si la firma es válida y no ha caducado; si no, `undefined`. */
  async readSigned(
    request: SignedRequest,
  ): Promise<{ body: Uint8Array; contentType: string } | undefined> {
    if (!this.verify('read', request)) return undefined;
    try {
      return { body: await this.get(request.key), contentType: contentTypeOf(request.key) };
    } catch {
      return undefined;
    }
  }

  /** Guarda el cuerpo si la URL de subida es válida y el tipo coincide con la clave. */
  async writeSigned(
    request: SignedRequest & { readonly body: Uint8Array; readonly contentType: string },
  ): Promise<boolean> {
    if (!this.verify('write', request) || request.contentType !== contentTypeOf(request.key)) {
      return false;
    }
    await this.put(request.key, request.body);
    return true;
  }

  private signedUrl(purpose: Purpose, key: string, ttlSeconds: number): string {
    this.pathFor(key);
    const expires = Math.floor(this.now().getTime() / 1000) + ttlSeconds;
    const url = new URL(`${this.options.publicBaseUrl}/api/files/${key}`);
    url.searchParams.set('expires', String(expires));
    url.searchParams.set('signature', this.sign(purpose, key, expires));
    return url.toString();
  }

  private verify(purpose: Purpose, { key, expires, signature }: SignedRequest): boolean {
    if (!KEY_PATTERN.test(key) || expires === null || signature === null) return false;
    const expiresAt = Number(expires);
    if (!Number.isInteger(expiresAt) || expiresAt * 1000 < this.now().getTime()) return false;

    const expected = Buffer.from(this.sign(purpose, key, expiresAt), 'hex');
    const received = Buffer.from(signature, 'hex');
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  private sign(purpose: Purpose, key: string, expires: number): string {
    return createHmac('sha256', this.options.signingSecret)
      .update(`${purpose}\n${key}\n${expires}`)
      .digest('hex');
  }

  private pathFor(key: string): string {
    if (!KEY_PATTERN.test(key) || key.split('/').some((part) => part === '..' || part === '.')) {
      throw new Error(`Invalid object key: ${key}`);
    }
    const path = resolve(join(this.rootDir, key));
    if (!path.startsWith(this.rootDir + sep)) throw new Error(`Invalid object key: ${key}`);
    return path;
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function contentTypeOf(key: string): string {
  const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}
