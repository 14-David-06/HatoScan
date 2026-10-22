/** Tipos de imagen que acepta la carga; los mismos que valida el caso de uso al registrar. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/tiff'] as const;

/** Valor del atributo `accept` del `<input type="file">`. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(',');

/**
 * Lado mayor (px) por debajo del cual la foto parece una copia reducida y no el original del dron.
 * Los drones de la finca sacan 4000–5500 px; los animales miden 10–20 px en el original.
 */
export const DOWNSCALED_LONG_SIDE_PX = 3000;

export interface PixelSize {
  readonly width: number;
  readonly height: number;
}

const TYPE_BY_EXTENSION: Readonly<Record<string, (typeof ACCEPTED_IMAGE_TYPES)[number]>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

function isAcceptedType(type: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/**
 * Tipo con el que se subirá el archivo, o `null` si no es JPG, PNG ni TIFF. Algunos sistemas no
 * informan el tipo de un TIFF; entonces se deduce de la extensión, porque el servidor lo exige.
 */
export function imageTypeOf(file: { readonly name: string; readonly type: string }): string | null {
  if (file.type) return isAcceptedType(file.type) ? file.type : null;
  return TYPE_BY_EXTENSION[extensionOf(file.name)] ?? null;
}

/** El mismo archivo con su tipo explícito (sin copiar los bytes), o `null` si no se acepta. */
export function normalizeImageFile(file: File): File | null {
  const type = imageTypeOf(file);
  if (type === null) return null;
  if (type === file.type) return file;
  return new File([file], file.name, { type, lastModified: file.lastModified });
}

export function isTiff(file: { readonly type: string }): boolean {
  return file.type === 'image/tiff';
}

export function looksDownscaled(size: PixelSize): boolean {
  return Math.max(size.width, size.height) < DOWNSCALED_LONG_SIDE_PX;
}

/** Lee `length` bytes desde `offset`; devuelve menos si el archivo termina antes. */
export type ByteReader = (offset: number, length: number) => Promise<ArrayBuffer>;

export function blobReader(blob: Blob): ByteReader {
  return (offset, length) => blob.slice(offset, offset + length).arrayBuffer();
}

const TAG_NEW_SUBFILE_TYPE = 254;
const TAG_IMAGE_WIDTH = 256;
const TAG_IMAGE_LENGTH = 257;
const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const MAX_IFDS = 8;

/**
 * Ancho y alto de un TIFF leyendo solo su cabecera: el navegador casi nunca puede decodificarlo
 * para la vista previa. Salta las miniaturas (NewSubfileType con el bit de resolución reducida).
 * Devuelve `null` si el archivo no es un TIFF clásico (BigTIFF incluido) o está dañado.
 */
export async function readTiffSize(read: ByteReader): Promise<PixelSize | null> {
  const header = new DataView(await read(0, 8));
  if (header.byteLength < 8) return null;
  const order = header.getUint16(0);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return null;
  if (header.getUint16(2, little) !== 42) return null;

  let offset = header.getUint32(4, little);
  const visited = new Set<number>();
  for (let i = 0; i < MAX_IFDS && offset !== 0 && !visited.has(offset); i += 1) {
    visited.add(offset);
    const countView = new DataView(await read(offset, 2));
    if (countView.byteLength < 2) return null;
    const entries = countView.getUint16(0, little);
    // Entradas de 12 bytes y, al final, el desplazamiento del siguiente directorio.
    const ifd = new DataView(await read(offset + 2, entries * 12 + 4));

    let width: number | undefined;
    let height: number | undefined;
    let reduced = false;
    for (let e = 0; e < entries && (e + 1) * 12 <= ifd.byteLength; e += 1) {
      const base = e * 12;
      const tag = ifd.getUint16(base, little);
      const type = ifd.getUint16(base + 2, little);
      const value =
        type === TYPE_SHORT
          ? ifd.getUint16(base + 8, little)
          : type === TYPE_LONG
            ? ifd.getUint32(base + 8, little)
            : undefined;
      if (tag === TAG_IMAGE_WIDTH) width = value;
      else if (tag === TAG_IMAGE_LENGTH) height = value;
      else if (tag === TAG_NEW_SUBFILE_TYPE && value !== undefined) reduced = (value & 1) === 1;
    }

    if (!reduced && width && height) return { width, height };
    const next = entries * 12;
    offset = ifd.byteLength >= next + 4 ? ifd.getUint32(next, little) : 0;
  }
  return null;
}
