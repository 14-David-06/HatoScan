import { describe, expect, it } from 'vitest';
import { InvalidValueError } from '@/domain/index';
import { FakeStorage } from '../../../test/fakes';
import { CreateImageUpload, isUploadKey, MAX_IMAGE_BYTES } from './create-image-upload';

const ID = '0b6f3c1e-9a2d-4f5b-8c7e-1d2a3b4c5d6e';

const useCase = () =>
  new CreateImageUpload({ storage: new FakeStorage(), ttlSeconds: 600, newUploadId: () => ID });

describe('CreateImageUpload', () => {
  it('returns a signed upload target under uploads/ with the extension of the type', async () => {
    const upload = await useCase().execute({ contentType: 'image/tiff', size: 25_000_000 });

    expect(upload).toEqual({
      uploadKey: `uploads/${ID}.tif`,
      url: `https://storage.test/uploads/${ID}.tif?upload`,
      method: 'PUT',
      headers: { 'content-type': 'image/tiff' },
    });
    expect(isUploadKey(upload.uploadKey)).toBe(true);
  });

  it('rejects unsupported types, empty files and files over the limit', async () => {
    await expect(useCase().execute({ contentType: 'image/gif', size: 10 })).rejects.toThrow(
      InvalidValueError,
    );
    await expect(useCase().execute({ contentType: 'image/jpeg', size: 0 })).rejects.toThrow(
      'empty',
    );
    await expect(
      useCase().execute({ contentType: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 }),
    ).rejects.toThrow('exceeds');
  });
});
