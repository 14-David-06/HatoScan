import { describe, expect, it } from 'vitest';
import { S3ObjectStorage } from './s3-object-storage';

// Firmar no llama a AWS: las URLs se pueden comprobar sin red ni credenciales reales.
const storage = new S3ObjectStorage({
  bucket: 'hatoscan-test',
  region: 'us-east-1',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
});

describe('S3ObjectStorage', () => {
  it('signs a browser upload bound to the content type and without checksum parameters', async () => {
    const target = await storage.getUploadUrl('uploads/a.jpg', 'image/jpeg', 600);
    const url = new URL(target.url);

    expect(url.host).toBe('hatoscan-test.s3.us-east-1.amazonaws.com');
    expect(url.pathname).toBe('/uploads/a.jpg');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
    expect(url.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toContain('content-type');
    // El navegador no calcula sumas de comprobación: si la URL las exige, S3 rechaza la subida.
    const params = [...url.searchParams.keys()].map((k) => k.toLowerCase());
    expect(params.some((k) => k.includes('checksum'))).toBe(false);
    expect(target).toMatchObject({ method: 'PUT', headers: { 'content-type': 'image/jpeg' } });
  });

  it('signs a read url for the detector and the review screen', async () => {
    const url = new URL(await storage.getReadUrl('counts/SIRIUS-CONTEO-0001/original.jpg', 900));

    expect(url.host).toBe('hatoscan-test.s3.us-east-1.amazonaws.com');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('x-id')).toBe('GetObject');
  });
});
