import { describe, expect, it } from 'vitest';
import { imageTypeOf, looksDownscaled, readTiffSize, type ByteReader } from './photo-file';

interface Entry {
  readonly tag: number;
  readonly type: 3 | 4;
  readonly value: number;
}

/** TIFF mínimo: cabecera + directorios encadenados, cada uno con sus entradas. */
function tiff(ifds: readonly (readonly Entry[])[], little = true): ArrayBuffer {
  const sizes = ifds.map((entries) => 2 + entries.length * 12 + 4);
  const buffer = new ArrayBuffer(8 + sizes.reduce((a, b) => a + b, 0));
  const view = new DataView(buffer);
  view.setUint16(0, little ? 0x4949 : 0x4d4d);
  view.setUint16(2, 42, little);
  let offset = 8;
  view.setUint32(4, offset, little);
  ifds.forEach((entries, index) => {
    view.setUint16(offset, entries.length, little);
    entries.forEach((entry, e) => {
      const base = offset + 2 + e * 12;
      view.setUint16(base, entry.tag, little);
      view.setUint16(base + 2, entry.type, little);
      view.setUint32(base + 4, 1, little);
      if (entry.type === 3) view.setUint16(base + 8, entry.value, little);
      else view.setUint32(base + 8, entry.value, little);
    });
    const next = offset + sizes[index]!;
    view.setUint32(offset + 2 + entries.length * 12, index < ifds.length - 1 ? next : 0, little);
    offset = next;
  });
  return buffer;
}

const reader =
  (buffer: ArrayBuffer): ByteReader =>
  async (offset, length) =>
    buffer.slice(offset, offset + length);

describe('imageTypeOf', () => {
  it('acepta JPG, PNG y TIFF por su tipo', () => {
    expect(imageTypeOf({ name: 'a.jpg', type: 'image/jpeg' })).toBe('image/jpeg');
    expect(imageTypeOf({ name: 'a.png', type: 'image/png' })).toBe('image/png');
    expect(imageTypeOf({ name: 'a.tif', type: 'image/tiff' })).toBe('image/tiff');
  });

  it('rechaza otros tipos aunque la extensión parezca válida', () => {
    expect(imageTypeOf({ name: 'DJI_0001.HEIC', type: 'image/heic' })).toBeNull();
    expect(imageTypeOf({ name: 'foto.jpg', type: 'application/pdf' })).toBeNull();
  });

  it('deduce el tipo por la extensión cuando el sistema no lo informa', () => {
    expect(imageTypeOf({ name: 'DJI_0001.TIF', type: '' })).toBe('image/tiff');
    expect(imageTypeOf({ name: 'mosaico.tiff', type: '' })).toBe('image/tiff');
    expect(imageTypeOf({ name: 'notas.txt', type: '' })).toBeNull();
    expect(imageTypeOf({ name: 'sin-extension', type: '' })).toBeNull();
  });
});

describe('looksDownscaled', () => {
  it('marca como reducida una foto con el lado mayor bajo 3000 px', () => {
    expect(looksDownscaled({ width: 1920, height: 1080 })).toBe(true);
    expect(looksDownscaled({ width: 2000, height: 2999 })).toBe(true);
    expect(looksDownscaled({ width: 5472, height: 3648 })).toBe(false);
    expect(looksDownscaled({ width: 3000, height: 2000 })).toBe(false);
  });
});

describe('readTiffSize', () => {
  it('lee ancho y alto en little endian (SHORT y LONG)', async () => {
    const file = tiff([
      [
        { tag: 256, type: 4, value: 5472 },
        { tag: 257, type: 3, value: 3648 },
      ],
    ]);
    await expect(readTiffSize(reader(file))).resolves.toEqual({ width: 5472, height: 3648 });
  });

  it('lee big endian', async () => {
    const file = tiff(
      [
        [
          { tag: 256, type: 3, value: 4000 },
          { tag: 257, type: 3, value: 3000 },
        ],
      ],
      false,
    );
    await expect(readTiffSize(reader(file))).resolves.toEqual({ width: 4000, height: 3000 });
  });

  it('salta la miniatura y usa el directorio de resolución completa', async () => {
    const file = tiff([
      [
        { tag: 254, type: 4, value: 1 },
        { tag: 256, type: 3, value: 160 },
        { tag: 257, type: 3, value: 120 },
      ],
      [
        { tag: 254, type: 4, value: 0 },
        { tag: 256, type: 4, value: 8192 },
        { tag: 257, type: 4, value: 5460 },
      ],
    ]);
    await expect(readTiffSize(reader(file))).resolves.toEqual({ width: 8192, height: 5460 });
  });

  it('devuelve null si no es un TIFF o le faltan las dimensiones', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).buffer;
    await expect(readTiffSize(reader(jpeg))).resolves.toBeNull();
    await expect(readTiffSize(reader(new ArrayBuffer(3)))).resolves.toBeNull();
    const noHeight = tiff([[{ tag: 256, type: 3, value: 100 }]]);
    await expect(readTiffSize(reader(noHeight))).resolves.toBeNull();
  });
});
