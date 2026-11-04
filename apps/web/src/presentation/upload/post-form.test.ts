import { describe, expect, it } from 'vitest';
import { readReply, readUploadTarget } from './post-form';

describe('readUploadTarget', () => {
  it('lee el destino de subida firmado', () => {
    const target = {
      uploadKey: 'uploads/x.jpg',
      url: 'https://bucket.s3.us-east-1.amazonaws.com/uploads/x.jpg?X-Amz-Signature=1',
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
    };
    expect(readUploadTarget(target)).toEqual(target);
  });

  it('rechaza respuestas sin la forma esperada', () => {
    expect(readUploadTarget({ error: 'x' })).toBeUndefined();
    expect(
      readUploadTarget({ uploadKey: 'k', url: 'u', method: 'POST', headers: {} }),
    ).toBeUndefined();
    expect(
      readUploadTarget({ uploadKey: 'k', url: 'u', method: 'PUT', headers: { a: 1 } }),
    ).toBeUndefined();
  });
});

describe('readReply', () => {
  it('lee el id del conteo creado', () => {
    expect(readReply({ id: 'SIRIUS-CONTEO-0042', status: 'subido' })).toEqual({
      id: 'SIRIUS-CONTEO-0042',
    });
  });

  it('lee el mensaje de error', () => {
    expect(readReply({ error: 'Adjunta la foto aérea original.' })).toEqual({
      error: 'Adjunta la foto aérea original.',
    });
  });

  it('ignora cuerpos sin la forma esperada', () => {
    expect(readReply(null)).toEqual({});
    expect(readReply('<html>')).toEqual({});
    expect(readReply({ id: 42, error: '' })).toEqual({});
  });
});
