import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { ObjectStorage } from '@/domain/index';

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

export interface SignedRead {
  readonly key: string;
  readonly expires: string | null;
  readonly signature: string | null;
}

/**
 * Almacenamiento en disco para desarrollo local, mientras se decide D1 (Pinata privado o GCS).
 * Las URLs de lectura caducan y van firmadas, como lo harán las del proveedor definitivo.
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
    this.pathFor(key);
    const expires = Math.floor(this.now().getTime() / 1000) + ttlSeconds;
    const url = new URL(`${this.options.publicBaseUrl}/api/files/${key}`);
    url.searchParams.set('expires', String(expires));
    url.searchParams.set('signature', this.sign(key, expires));
    return Promise.resolve(url.toString());
  }

  /** Devuelve el objeto si la firma es válida y no ha caducado; si no, `undefined`. */
  async readSigned(
    request: SignedRead,
  ): Promise<{ body: Uint8Array; contentType: string } | undefined> {
    const { key, expires, signature } = request;
    if (!KEY_PATTERN.test(key) || expires === null || signature === null) return undefined;
    const expiresAt = Number(expires);
    if (!Number.isInteger(expiresAt) || expiresAt * 1000 < this.now().getTime()) return undefined;

    const expected = Buffer.from(this.sign(key, expiresAt), 'hex');
    const received = Buffer.from(signature, 'hex');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return undefined;
    }

    try {
      return { body: await this.get(key), contentType: contentTypeOf(key) };
    } catch {
      return undefined;
    }
  }

  private sign(key: string, expires: number): string {
    return createHmac('sha256', this.options.signingSecret)
      .update(`${key}\n${expires}`)
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

function contentTypeOf(key: string): string {
  const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}
