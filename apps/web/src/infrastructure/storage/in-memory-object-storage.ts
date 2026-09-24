import type { ObjectStorage } from '@/domain/index';

/** Almacenamiento en memoria para desarrollo local y tests. No usar en producción. */
export class InMemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  get(key: string): Promise<Uint8Array> {
    const object = this.objects.get(key);
    if (!object) return Promise.reject(new Error(`Object not found: ${key}`));
    return Promise.resolve(object.body);
  }

  getReadUrl(key: string): Promise<string> {
    return Promise.resolve(`memory://${key}`);
  }
}
