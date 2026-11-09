/**
 * Teselado para los métodos con modelos multimodales (Claude, OpenAI).
 *
 * Una foto de dron es más grande de lo que un modelo de visión acepta y los animales miden 10-20 px,
 * así que no se reduce: se recorta en teselas a resolución completa, cada una se amplía y se
 * consulta por separado. Cada tesela es dueña de su "núcleo" (la tesela menos la mitad del solape
 * con sus vecinas): un punto solo se conserva en la tesela cuyo núcleo lo contiene, así el solape
 * no duplica animales.
 */
import sharp from 'sharp';
import { DetectorError, type RawDetection, type RawDetectionOutput } from './method';

/** Imagen que se envía al modelo: la tesela recortada y luego ampliada. */
export interface TileImage {
  readonly png: Buffer;
  /** Tamaño de la imagen enviada, en píxeles. */
  readonly width: number;
  readonly height: number;
}

/** Animal propuesto por el modelo, en píxeles de la imagen enviada (`TileImage`). */
export interface TilePoint {
  readonly x: number;
  readonly y: number;
  readonly confidence: number;
}

export type AskTile = (tile: TileImage, signal: AbortSignal) => Promise<readonly TilePoint[]>;

export interface TilingOptions {
  /** Lado de la tesela en píxeles de la imagen original. */
  readonly tilePx: number;
  /** Cuánto se amplía la tesela antes de enviarla. */
  readonly upscale: number;
  readonly overlap: number;
  readonly minConfidence: number;
  readonly maxParallelRequests: number;
  readonly signal: AbortSignal;
  readonly ask: AskTile;
}

interface DecodedImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  readonly channels: number;
}

type Region = readonly [left: number, top: number, right: number, bottom: number];

/** Consulta `ask` por cada tesela y devuelve los puntos en píxeles de la imagen original. */
export async function detectInTiles(
  image: Uint8Array,
  options: TilingOptions,
): Promise<RawDetectionOutput> {
  const decoded = await decodeImage(image);
  const { width, height } = decoded;
  const { tilePx, upscale, minConfidence } = options;
  const origins = tileOrigins(width, height, tilePx, options.overlap);
  const cores = coreRegions(origins, width, height, tilePx);

  const perTile = await mapWithConcurrency(
    origins.map((origin, index) => ({ origin, core: cores[index] as Region })),
    options.maxParallelRequests,
    options.signal,
    async ({ origin: [x0, y0], core: [left, top, right, bottom] }, signal) => {
      const cropWidth = Math.min(tilePx, width - x0);
      const cropHeight = Math.min(tilePx, height - y0);
      const tile = await renderTile(decoded, x0, y0, cropWidth, cropHeight, upscale);
      // Píxeles de la imagen enviada → píxeles de la tesela recortada → píxeles originales.
      const scaleX = cropWidth / tile.width;
      const scaleY = cropHeight / tile.height;
      const kept: RawDetection[] = [];
      for (const point of await options.ask(tile, signal)) {
        if (point.confidence < minConfidence) continue;
        const x = x0 + point.x * scaleX;
        const y = y0 + point.y * scaleY;
        if (x >= left && x < right && y >= top && y < bottom) {
          kept.push({ x, y, kind: 'punto', score: point.confidence });
        }
      }
      return kept;
    },
  );
  return { width, height, detections: perTile.flat() };
}

/** Esquinas de teselas solapadas que cubren toda la imagen; la última se pega al borde. */
export function tileOrigins(
  width: number,
  height: number,
  tile: number,
  overlap: number,
): (readonly [number, number])[] {
  const axis = (length: number): number[] => {
    if (length <= tile) return [0];
    const stride = Math.max(1, Math.trunc(tile * (1 - overlap)));
    const starts: number[] = [];
    for (let start = 0; start < length - tile; start += stride) starts.push(start);
    return [...starts, length - tile];
  };
  const xs = axis(width);
  return axis(height).flatMap((y) => xs.map((x) => [x, y] as const));
}

/**
 * Núcleo de cada tesela: se parte el solape con cada vecina por la mitad. Los núcleos no se
 * solapan y cubren toda la imagen, así cada punto pertenece a una sola tesela.
 */
export function coreRegions(
  origins: readonly (readonly [number, number])[],
  width: number,
  height: number,
  tile: number,
): Region[] {
  const bounds = (starts: number[], length: number): Map<number, readonly [number, number]> => {
    const result = new Map<number, readonly [number, number]>();
    starts.forEach((start, i) => {
      const previous = starts[i - 1];
      const next = starts[i + 1];
      const low = previous === undefined ? 0 : (start + previous + tile) / 2;
      const high = next === undefined ? length : (next + start + tile) / 2;
      result.set(start, [low, high]);
    });
    return result;
  };
  const unique = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b);
  const bx = bounds(unique(origins.map(([x]) => x)), width);
  const by = bounds(unique(origins.map(([, y]) => y)), height);
  return origins.map(([x, y]) => {
    const [left, right] = bx.get(x) ?? [0, width];
    const [top, bottom] = by.get(y) ?? [0, height];
    return [left, top, right, bottom] as const;
  });
}

/**
 * Decodifica a resolución completa, en RGB de 8 bits. Aplica la orientación EXIF, igual que el
 * navegador, para que las coordenadas coincidan con la imagen que ve el revisor.
 */
async function decodeImage(image: Uint8Array): Promise<DecodedImage> {
  let decoded: DecodedImage;
  try {
    const { data, info } = await sharp(image)
      .autoOrient()
      .toColourspace('srgb')
      .removeAlpha()
      .raw({ depth: 'uchar' })
      .toBuffer({ resolveWithObject: true });
    decoded = { data, width: info.width, height: info.height, channels: info.channels };
  } catch (error) {
    throw new DetectorError(
      `Could not decode image (expected JPEG, PNG or TIFF): ${errorMessage(error)}`,
      { cause: error },
    );
  }
  if (decoded.channels !== RGB_CHANNELS) {
    throw new DetectorError(`Unexpected ${decoded.channels} channels after decoding to RGB`);
  }
  return decoded;
}

const RGB_CHANNELS = 3;

/** Recorta la tesela de la imagen decodificada, la amplía (Catmull-Rom) y la codifica en PNG. */
async function renderTile(
  decoded: DecodedImage,
  left: number,
  top: number,
  cropWidth: number,
  cropHeight: number,
  upscale: number,
): Promise<TileImage> {
  const { channels } = decoded;
  const rowBytes = cropWidth * channels;
  const crop = Buffer.allocUnsafe(rowBytes * cropHeight);
  for (let row = 0; row < cropHeight; row++) {
    const start = ((top + row) * decoded.width + left) * channels;
    decoded.data.copy(crop, row * rowBytes, start, start + rowBytes);
  }

  const width = Math.round(cropWidth * upscale);
  const height = Math.round(cropHeight * upscale);
  let pipeline = sharp(crop, {
    raw: { width: cropWidth, height: cropHeight, channels: RGB_CHANNELS },
  });
  if (width !== cropWidth || height !== cropHeight) {
    pipeline = pipeline.resize(width, height, { kernel: 'cubic', fit: 'fill' });
  }
  return { png: await pipeline.png().toBuffer(), width, height };
}

/**
 * Como `Promise.all(items.map(fn))`, con como mucho `limit` tareas a la vez. Al primer fallo
 * cancela las demás (su `signal`) y lo relanza; si `signal` se cancela desde fuera, lanza su motivo.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  signal: AbortSignal,
  fn: (item: T, signal: AbortSignal) => Promise<R>,
): Promise<R[]> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const forward = () => controller.abort(signal.reason);
  signal.addEventListener('abort', forward, { once: true });

  const results: R[] = new Array<R>(items.length);
  let next = 0;
  let failure: { readonly error: unknown } | undefined;
  const worker = async (): Promise<void> => {
    while (!controller.signal.aborted) {
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index] as T, controller.signal);
      } catch (error) {
        failure ??= { error };
        controller.abort(error);
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  } finally {
    signal.removeEventListener('abort', forward);
  }
  signal.throwIfAborted();
  if (failure) throw failure.error;
  return results;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
