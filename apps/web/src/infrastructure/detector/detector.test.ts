import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { toCountId } from '@/domain/index';
import { createDetectionMethods, enabledMethods } from './catalog';
import { ClaudeVisionMethod } from './claude-vision';
import { InProcessDetector } from './in-process-detector';
import {
  DetectorError,
  InvalidDetectorParamsError,
  type DetectionMethodAdapter,
  type DetectionParams,
  type RawDetectionOutput,
} from './method';
import { OpenAiVisionMethod, parseResponse } from './openai-vision';
import { paramsHash } from './params-hash';
import { coreRegions, detectInTiles, mapWithConcurrency, tileOrigins } from './tiling';
import { NORMALIZED_SYSTEM_PROMPT } from './vision-prompt';

const COUNT_ID = toCountId('SIRIUS-CONTEO-0001');
const NEVER = new AbortController().signal;
/** Un argumento `undefined` tomaría el valor por defecto de los helpers; este marca "sin llave". */
const NO_KEY = 'no-key';

const png = (width: number, height: number): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: '#000000' } })
    .png()
    .toBuffer();

interface Captured {
  readonly url: string;
  readonly headers: Headers;
  readonly body: Record<string, unknown>;
}

/** `fetch` falso que guarda cada petición y responde con `respond(body)`. */
function fakeFetch(respond: (body: Record<string, unknown>) => Response) {
  const requests: Captured[] = [];
  const impl = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({ url: String(input), headers: new Headers(init?.headers), body });
    return Promise.resolve(respond(body));
  };
  return { requests, fetch: impl as typeof fetch };
}

describe('tiling', () => {
  it('core regions partition the image so the overlap never duplicates a point', () => {
    const [width, height, tile] = [1000, 700, 300];
    const origins = tileOrigins(width, height, tile, 0.2);
    const cores = coreRegions(origins, width, height, tile);
    for (let y = 0; y < height; y += 7) {
      for (let x = 0; x < width; x += 7) {
        const owners = cores.filter(([l, t, r, b]) => x >= l && x < r && y >= t && y < b);
        expect(owners).toHaveLength(1);
      }
    }
  });

  it('covers the whole image, with the last tile flush against the edge', () => {
    expect(tileOrigins(1000, 300, 400, 0)).toEqual([
      [0, 0],
      [400, 0],
      [600, 0],
    ]);
    expect(tileOrigins(200, 100, 400, 0.1)).toEqual([[0, 0]]);
  });

  it('applies the EXIF orientation, like the browser does', async () => {
    // 300x100 guardada de lado (orientación 6): el navegador la muestra de 100x300.
    const rotated = await sharp({
      create: { width: 300, height: 100, channels: 3, background: '#000000' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const output = await detectInTiles(rotated, {
      tilePx: 512,
      upscale: 1,
      overlap: 0,
      minConfidence: 0,
      maxParallelRequests: 1,
      signal: NEVER,
      ask: () => Promise.resolve([]),
    });
    expect([output.width, output.height]).toEqual([100, 300]);
  });

  it('decodes grayscale images to RGB tiles at the requested upscale', async () => {
    const sizes: [number, number][] = [];
    const gray = await sharp(await png(300, 200))
      .toColourspace('b-w')
      .png()
      .toBuffer();
    expect((await sharp(gray).metadata()).channels).toBe(1);
    await detectInTiles(gray, {
      tilePx: 256,
      upscale: 2,
      overlap: 0,
      minConfidence: 0,
      maxParallelRequests: 2,
      signal: NEVER,
      ask: async (tile) => {
        const meta = await sharp(tile.png).metadata();
        expect(meta.channels).toBe(3);
        sizes.push([tile.width, tile.height]);
        return [];
      },
    });
    expect(sizes.sort()).toEqual([
      [512, 400],
      [512, 400],
    ]);
  });

  it('rejects bytes that are not an image', async () => {
    await expect(
      detectInTiles(new TextEncoder().encode('not an image'), {
        tilePx: 256,
        upscale: 1,
        overlap: 0,
        minConfidence: 0,
        maxParallelRequests: 1,
        signal: NEVER,
        ask: () => Promise.resolve([]),
      }),
    ).rejects.toThrow(DetectorError);
  });
});

describe('mapWithConcurrency', () => {
  it('never runs more than the limit at once and keeps the order', async () => {
    let running = 0;
    let peak = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, NEVER, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return n * 10;
    });
    expect(result).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });

  it('cancels the remaining work after the first failure', async () => {
    const started: number[] = [];
    let cancelled = false;
    const run = mapWithConcurrency([1, 2, 3, 4], 2, NEVER, (n, signal) => {
      started.push(n);
      if (n === 1) return Promise.reject(new DetectorError('tile 1 failed'));
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          cancelled = true;
          reject(new Error('aborted'));
        });
      });
    });
    await expect(run).rejects.toThrow('tile 1 failed');
    expect(cancelled).toBe(true);
    expect(started).toEqual([1, 2]);
  });

  it('throws the outer reason when cancelled from outside', async () => {
    const controller = new AbortController();
    const run = mapWithConcurrency([1], 1, controller.signal, (_n, signal) => {
      controller.abort(new Error('time is up'));
      return Promise.resolve(signal.aborted);
    });
    await expect(run).rejects.toThrow('time is up');
  });
});

describe('paramsHash', () => {
  it('does not depend on key order', () => {
    const a = paramsHash({ tile_px: 1024, model: 'm', nested: { b: 1, a: [2, { d: 1, c: 2 }] } });
    const b = paramsHash({ nested: { a: [2, { c: 2, d: 1 }], b: 1 }, model: 'm', tile_px: 1024 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(paramsHash({ tile_px: 1023, model: 'm' })).not.toBe(
      paramsHash({ tile_px: 1024, model: 'm' }),
    );
  });
});

const claudeMessage = (text: string, stopReason = 'end_turn') =>
  Response.json({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: text ? [{ type: 'text', text }] : [],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  });

const claude = (fetchImpl: typeof fetch, apiKey: string | undefined = 'test-key') =>
  new ClaudeVisionMethod({
    apiKey: apiKey === NO_KEY ? undefined : apiKey,
    name: 'claude-vision',
    model: 'claude-opus-5-5',
    label: 'Claude',
    description: '',
    fetch: fetchImpl,
  });

/** Tamaño de la imagen enviada, leído del texto de la petición ("mide WxH px"). */
function sentSize(body: Record<string, unknown>): [number, number] {
  const match = /mide (\d+)x(\d+) px/.exec(JSON.stringify(body));
  if (!match) throw new Error('size not found in request');
  return [Number(match[1]), Number(match[2])];
}

describe('ClaudeVisionMethod', () => {
  it('returns points in original pixels, without duplicates, using structured output', async () => {
    const { requests, fetch: fetchImpl } = fakeFetch((body) => {
      const [w, h] = sentSize(body);
      return claudeMessage(
        JSON.stringify({
          animals: [
            { x: w / 2, y: h / 2, confidence: 0.9 },
            { x: 1, y: 1, confidence: 0.1 },
          ],
        }),
      );
    });
    const method = claude(fetchImpl);
    const params = method.resolveParams({ tile_px: 400, upscale: 2, overlap: 0 });

    const output = await method.detect(await png(800, 400), params, NEVER);

    expect([output.width, output.height]).toEqual([800, 400]);
    expect(output.detections.map((d) => [d.x, d.y]).sort()).toEqual([
      [200, 200],
      [600, 200],
    ]);
    expect(output.detections.every((d) => d.kind === 'punto' && d.score === 0.9)).toBe(true);
    expect(requests).toHaveLength(2);
    const [first] = requests;
    expect(first?.body.model).toBe('claude-opus-5-5');
    expect(first?.body.fallbacks).toBe('default');
    expect(first?.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(first?.body.thinking).toEqual({ type: 'adaptive' });
    expect(first?.body.output_config).toMatchObject({
      effort: 'low',
      format: { type: 'json_schema' },
    });
    expect(sentSize(first?.body ?? {})).toEqual([800, 800]);
  });

  it('fails loudly when Claude declines', async () => {
    const { fetch: fetchImpl } = fakeFetch(() => claudeMessage('', 'refusal'));
    const method = claude(fetchImpl);
    await expect(
      method.detect(await png(300, 300), method.resolveParams(undefined), NEVER),
    ).rejects.toThrow(/declined/);
  });

  it('explains a rejected API key', async () => {
    const { fetch: fetchImpl } = fakeFetch(() =>
      Response.json(
        { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
        { status: 401 },
      ),
    );
    const method = claude(fetchImpl);
    await expect(
      method.detect(await png(300, 300), method.resolveParams(undefined), NEVER),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it('is unavailable without a key and rejects tiles too large for Claude', () => {
    const { fetch: fetchImpl } = fakeFetch(() => claudeMessage('{}'));
    expect(claude(fetchImpl, NO_KEY).available).toBe(false);
    expect(claude(fetchImpl, '').available).toBe(false);
    expect(() => claude(fetchImpl).resolveParams({ tile_px: 2000, upscale: 2 })).toThrow(
      InvalidDetectorParamsError,
    );
    expect(() => claude(fetchImpl).resolveParams({ nope: 1 })).toThrow(InvalidDetectorParamsError);
  });

  it('records the full parameter set, model included', () => {
    const { fetch: fetchImpl } = fakeFetch(() => claudeMessage('{}'));
    expect(claude(fetchImpl).resolveParams(undefined)).toEqual({
      model: 'claude-opus-5-5',
      effort: 'low',
      tile_px: 1024,
      upscale: 2,
      overlap: 0.1,
      min_confidence: 0.3,
      max_parallel_requests: 16,
    });
  });
});

const openAiCompleted = (animals: { x: number; y: number; confidence: number }[]) => ({
  status: 'completed',
  output: [
    { type: 'reasoning', summary: [] },
    {
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify({ animals }) }],
    },
  ],
});

const openAi = (fetchImpl: typeof fetch, apiKey: string | undefined = 'test-key') =>
  new OpenAiVisionMethod({
    apiKey: apiKey === NO_KEY ? undefined : apiKey,
    name: 'openai-vision',
    model: 'gpt-6-astra',
    label: 'GPT',
    description: '',
    fetch: fetchImpl,
  });

describe('OpenAiVisionMethod', () => {
  it('maps normalized points back to original pixels without duplicates', async () => {
    const { requests, fetch: fetchImpl } = fakeFetch(() =>
      Response.json(
        openAiCompleted([
          { x: 0.5, y: 0.5, confidence: 0.9 },
          { x: 0, y: 0, confidence: 0.1 },
        ]),
      ),
    );
    const method = openAi(fetchImpl);
    const output = await method.detect(
      await png(1000, 600),
      method.resolveParams({ tile_px: 512, overlap: 0.1 }),
      NEVER,
    );

    expect([output.width, output.height]).toEqual([1000, 600]);
    expect(requests[0]?.body.model).toBe('gpt-6-astra');
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer test-key');
    expect(output.detections).toHaveLength(requests.length);
    for (const d of output.detections) {
      expect(d.score).toBe(0.9);
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThan(1000);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeLessThan(600);
    }
    const distinct = new Set(output.detections.map((d) => `${Math.round(d.x)},${Math.round(d.y)}`));
    expect(distinct.size).toBe(output.detections.length);
  });

  it('asks for normalized coordinates', () => {
    expect(NORMALIZED_SYSTEM_PROMPT).toContain('fracción del ancho');
    expect(NORMALIZED_SYSTEM_PROMPT).not.toContain('píxeles de la imagen que recibes');
  });

  it('turns API errors, refusals and incomplete answers into detector errors', async () => {
    const { fetch: fetchImpl } = fakeFetch(() => Response.json({ error: {} }, { status: 401 }));
    const method = openAi(fetchImpl);
    await expect(
      method.detect(await png(300, 300), method.resolveParams(undefined), NEVER),
    ).rejects.toThrow(/OPENAI_API_KEY/);

    expect(() =>
      parseResponse({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal' }] }],
      }),
    ).toThrow(/declined/);
    expect(() =>
      parseResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }),
    ).toThrow(/max_output_tokens/);
  });

  it('is unavailable without a key and rejects unknown params', () => {
    const { fetch: fetchImpl } = fakeFetch(() => Response.json({}));
    expect(openAi(fetchImpl, NO_KEY).available).toBe(false);
    expect(() => openAi(fetchImpl).resolveParams({ nope: 1 })).toThrow(InvalidDetectorParamsError);
  });
});

class FakeMethod implements DetectionMethodAdapter {
  readonly version = '1.2.3';
  readonly label = 'Falso';
  readonly description = 'Método de prueba.';
  received: Uint8Array | undefined;

  constructor(
    readonly name: string,
    readonly available = true,
    private readonly run: (signal: AbortSignal) => Promise<RawDetectionOutput> = () =>
      Promise.resolve({
        width: 5472,
        height: 3648,
        detections: [
          { x: 10, y: 20, kind: 'caja', w: 15, h: 12, score: 0.9 },
          { x: 100, y: 200, kind: 'punto' },
        ],
      }),
  ) {}

  resolveParams(params: DetectionParams | undefined): DetectionParams {
    return { threshold: 0.5, ...params };
  }

  detect(image: Uint8Array, _params: DetectionParams, signal: AbortSignal) {
    this.received = image;
    return this.run(signal);
  }
}

describe('InProcessDetector', () => {
  const image = new Uint8Array([1, 2, 3]);

  it('runs the default method and returns model detections with version and params hash', async () => {
    const fake = new FakeMethod('fake');
    const detector = new InProcessDetector({
      methods: [fake],
      defaultMethod: 'fake',
      timeoutMs: 1000,
    });

    const output = await detector.detect({ countId: COUNT_ID, image });

    expect(fake.received).toBe(image);
    expect(output.detector.version).toBe('fake@1.2.3');
    expect(output.detector.paramsHash).toBe(paramsHash({ threshold: 0.5 }));
    expect(output.params).toEqual({ threshold: 0.5 });
    expect(output.image).toEqual({ width: 5472, height: 3648 });
    expect(output.detections).toEqual([
      {
        id: 'm-1',
        x: 10,
        y: 20,
        tipo: 'caja',
        w: 15,
        h: 12,
        score: 0.9,
        origen: 'modelo',
        estado: 'activa',
      },
      { id: 'm-2', x: 100, y: 200, tipo: 'punto', origen: 'modelo', estado: 'activa' },
    ]);
    expect(output.processingMs).toBeGreaterThanOrEqual(0);
  });

  it('lists every method, available or not, with the default', async () => {
    const detector = new InProcessDetector({
      methods: [new FakeMethod('a'), new FakeMethod('b', false)],
      defaultMethod: 'a',
      timeoutMs: 1000,
    });
    const catalog = await detector.methods();
    expect(catalog.defaultMethod).toBe('a');
    expect(catalog.methods.map((m) => [m.name, m.available])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });

  it('rejects unknown and unavailable methods', async () => {
    const detector = new InProcessDetector({
      methods: [new FakeMethod('a'), new FakeMethod('b', false)],
      defaultMethod: 'a',
      timeoutMs: 1000,
    });
    await expect(detector.detect({ countId: COUNT_ID, image, detector: 'zzz' })).rejects.toThrow(
      /Unknown detector/,
    );
    await expect(detector.detect({ countId: COUNT_ID, image, detector: 'b' })).rejects.toThrow(
      /not available/,
    );
  });

  it('gives up with a clear message when the detection takes too long', async () => {
    const slow = new FakeMethod(
      'slow',
      true,
      (signal) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
    );
    const detector = new InProcessDetector({
      methods: [slow],
      defaultMethod: 'slow',
      timeoutMs: 20,
    });
    await expect(detector.detect({ countId: COUNT_ID, image })).rejects.toThrow(
      /did not finish within .*DETECTOR_TIMEOUT_MS/,
    );
  });

  it('refuses a default method that is not enabled', () => {
    expect(
      () =>
        new InProcessDetector({ methods: [new FakeMethod('a')], defaultMethod: 'b', timeoutMs: 1 }),
    ).toThrow(/not among the enabled/);
  });
});

describe('catalog', () => {
  const all = createDetectionMethods({ anthropicApiKey: 'k', openaiApiKey: undefined });

  it('offers the AI methods, available only with their provider key', () => {
    expect(all.map((m) => [m.name, m.available])).toEqual([
      ['claude-vision', true],
      ['claude-vision-sonnet', true],
      ['openai-vision', false],
      ['openai-vision-sol', false],
    ]);
  });

  it('filters by the enabled list and rejects unknown names', () => {
    expect(enabledMethods(all, undefined)).toHaveLength(4);
    expect(enabledMethods(all, ['openai-vision', 'claude-vision']).map((m) => m.name)).toEqual([
      'claude-vision',
      'openai-vision',
    ]);
    expect(() => enabledMethods(all, ['classic-cv'])).toThrow(/classic-cv/);
  });
});
