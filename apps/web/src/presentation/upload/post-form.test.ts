import { describe, expect, it } from 'vitest';
import { readReply } from './post-form';

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
