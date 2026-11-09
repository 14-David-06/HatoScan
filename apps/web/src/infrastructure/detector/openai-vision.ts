/**
 * Método con modelos de visión de OpenAI (Responses API) sobre teselas de la foto.
 *
 * OpenAI puede reescalar internamente la imagen que recibe, así que no se le piden píxeles sino
 * coordenadas normalizadas (0-1) dentro de la tesela: sobreviven a cualquier reescalado. Se llama
 * a la API con `fetch` en lugar de sumar el SDK de OpenAI por un solo endpoint.
 */
import { z } from 'zod';
import {
  DetectorError,
  type DetectionMethodAdapter,
  type DetectionParams,
  type RawDetectionOutput,
} from './method';
import { parseParams } from './resolve-params';
import { detectInTiles, errorMessage, type TileImage, type TilePoint } from './tiling';
import { NORMALIZED_SYSTEM_PROMPT } from './vision-prompt';

export const RESPONSES_URL = 'https://api.openai.com/v1/responses';

const TILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['animals'],
  properties: {
    animals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['x', 'y', 'confidence'],
        properties: {
          x: { type: 'number', description: 'Centro, fracción del ancho (0-1)' },
          y: { type: 'number', description: 'Centro, fracción del alto (0-1)' },
          confidence: { type: 'number', description: '0 a 1' },
        },
      },
    },
  },
} as const;

const NormalizedAnimalsSchema = z.object({
  animals: z.array(
    z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

type NormalizedPoint = z.infer<typeof NormalizedAnimalsSchema>['animals'][number];

/** Lo que se lee de la respuesta; el resto del JSON se ignora. */
const ResponseSchema = z.object({
  status: z.string().optional(),
  incomplete_details: z.object({ reason: z.string().optional() }).nullish(),
  output: z
    .array(
      z.object({
        type: z.string(),
        content: z
          .array(z.object({ type: z.string(), text: z.string().optional() }).passthrough())
          .optional(),
      }),
    )
    .default([]),
});

const ParamsSchema = z
  .object({
    model: z.string().min(1),
    // "low": mismo conteo, varias veces más rápido que "high" (medido con GPT-6.1 Sol).
    effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('low'),
    // 512 px ampliados 1.5 veces = 768 px: el tamaño que OpenAI analiza sin reducir.
    tile_px: z.number().int().min(128).max(1024).default(512),
    upscale: z.number().min(1).max(4).default(1.5),
    overlap: z.number().min(0).max(0.5).default(0.1),
    min_confidence: z.number().min(0).max(1).default(0.3),
    max_parallel_requests: z.number().int().min(1).max(32).default(16),
    timeout_s: z.number().positive().default(300),
  })
  .strict();

type OpenAiVisionParams = z.infer<typeof ParamsSchema>;

export interface OpenAiVisionOptions {
  readonly apiKey: string | undefined;
  readonly name: string;
  readonly model: string;
  readonly label: string;
  readonly description: string;
  /** Solo para pruebas: reemplaza la red. */
  readonly fetch?: typeof fetch;
}

/** Un método por modelo de OpenAI: mismo código, distinto nombre y modelo. */
export class OpenAiVisionMethod implements DetectionMethodAdapter {
  readonly version = '0.2.0';
  readonly name: string;
  readonly label: string;
  readonly description: string;

  constructor(private readonly options: OpenAiVisionOptions) {
    this.name = options.name;
    this.label = options.label;
    this.description = options.description;
  }

  get available(): boolean {
    return Boolean(this.options.apiKey);
  }

  resolveParams(params: DetectionParams | undefined): OpenAiVisionParams {
    return parseParams(ParamsSchema, this.name, { model: this.options.model, ...params });
  }

  async detect(
    image: Uint8Array,
    params: DetectionParams,
    signal: AbortSignal,
  ): Promise<RawDetectionOutput> {
    const p = this.resolveParams(params);
    const { apiKey } = this.options;
    if (!apiKey) throw new DetectorError('OPENAI_API_KEY is not configured');
    return detectInTiles(image, {
      tilePx: p.tile_px,
      upscale: p.upscale,
      overlap: p.overlap,
      minConfidence: p.min_confidence,
      maxParallelRequests: p.max_parallel_requests,
      signal,
      ask: async (tile, tileSignal) =>
        (await this.ask(apiKey, tile, p, tileSignal)).map((a) => ({
          x: a.x * tile.width,
          y: a.y * tile.height,
          confidence: a.confidence,
        })) satisfies TilePoint[],
    });
  }

  private async ask(
    apiKey: string,
    tile: TileImage,
    p: OpenAiVisionParams,
    signal: AbortSignal,
  ): Promise<NormalizedPoint[]> {
    const body = {
      model: p.model,
      instructions: NORMALIZED_SYSTEM_PROMPT,
      reasoning: { effort: p.effort },
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: `data:image/png;base64,${tile.png.toString('base64')}`,
              detail: 'high',
            },
            { type: 'input_text', text: 'Marca cada animal.' },
          ],
        },
      ],
      text: {
        format: { type: 'json_schema', name: 'tile_animals', strict: true, schema: TILE_SCHEMA },
      },
    };

    const timeout = AbortSignal.timeout(p.timeout_s * 1000);
    let response: Response;
    try {
      response = await (this.options.fetch ?? fetch)(RESPONSES_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.any([signal, timeout]),
      });
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (timeout.aborted) {
        throw new DetectorError(`OpenAI did not answer within ${p.timeout_s} s`, { cause: error });
      }
      throw new DetectorError(`Could not reach the OpenAI API: ${errorMessage(error)}`, {
        cause: error,
      });
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      if (response.status === 401) {
        throw new DetectorError('OpenAI rejected the API key (OPENAI_API_KEY)');
      }
      if (response.status === 429) {
        throw new DetectorError(`OpenAI rate limit reached: ${detail}`);
      }
      throw new DetectorError(`OpenAI API error ${response.status}: ${detail}`);
    }
    return parseResponse(await response.json());
  }
}

/** Extrae los puntos del JSON de la respuesta; rechaza respuestas incompletas o negadas. */
export function parseResponse(payload: unknown): NormalizedPoint[] {
  const parsed = ResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new DetectorError(`OpenAI returned an unexpected response: ${parsed.error.message}`);
  }
  const { status, incomplete_details: incomplete, output } = parsed.data;
  if (status !== 'completed') {
    throw new DetectorError(
      `OpenAI returned no usable answer (${incomplete?.reason ?? status ?? 'no status'})`,
    );
  }
  for (const item of output) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'refusal') throw new DetectorError('OpenAI declined to analyse the image');
      if (part.type === 'output_text') {
        let json: unknown;
        try {
          json = JSON.parse(part.text ?? '');
        } catch (error) {
          throw new DetectorError(`OpenAI returned invalid JSON: ${errorMessage(error)}`);
        }
        const animals = NormalizedAnimalsSchema.safeParse(json);
        if (!animals.success) {
          throw new DetectorError(`OpenAI returned invalid JSON: ${animals.error.message}`);
        }
        return animals.data.animals;
      }
    }
  }
  throw new DetectorError('OpenAI returned no text output');
}
