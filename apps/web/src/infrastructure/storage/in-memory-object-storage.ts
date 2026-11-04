import type { ObjectInfo, ObjectStorage, UploadTarget } from '@/domain/index';

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

  getUploadUrl(key: string, contentType: string): Promise<UploadTarget> {
    return Promise.resolve({
      url: `memory://${key}`,
      method: 'PUT',
      headers: { 'content-type': contentType },
    });
  }

  stat(key: string): Promise<ObjectInfo | undefined> {
    const object = this.objects.get(key);
    return Promise.resolve(
      object && { size: object.body.byteLength, contentType: object.contentType },
    );
  }

  copy(fromKey: string, toKey: string): Promise<void> {
    const object = this.objects.get(fromKey);
    if (!object) return Promise.reject(new Error(`Object not found: ${fromKey}`));
    this.objects.set(toKey, object);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }
}
