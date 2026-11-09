/**
 * Método con Claude (visión): el modelo marca cada animal en teselas de la foto.
 *
 * Claude acepta imágenes de hasta 2576 px de lado y devuelve coordenadas 1:1 con los píxeles de la
 * imagen que recibe. Cada tesela se amplía para que el animal sea visible y se envía por separado;
 * los puntos vuelven a píxeles de la imagen original (ver `tiling`).
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import * as z4 from 'zod/v4';
import {
  DetectorError,
  type DetectionMethodAdapter,
  type DetectionParams,
  type RawDetectionOutput,
} from './method';
import { parseParams } from './resolve-params';
import { detectInTiles, errorMessage, type TileImage, type TilePoint } from './tiling';
import { SYSTEM_PROMPT } from './vision-prompt';

export const MAX_IMAGE_SIDE_PX = 2576;

/** Respuesta por tesela. Va con el SDK de Anthropic, que usa Zod 4 para los formatos de salida. */
const TileAnimalsSchema = z4.object({
  animals: z4.array(
    z4.object({
      x: z4.number().describe('Centro del animal, píxeles horizontales de esta imagen'),
      y: z4.number().describe('Centro del animal, píxeles verticales de esta imagen'),
      confidence: z4.number().describe('0 a 1: qué tan seguro estás de que es un animal'),
    }),
  ),
});

const ParamsSchema = z
  .object({
    model: z.string().min(1),
    // Marcar animales es percepción, no razonamiento largo: "low" da el mismo conteo en segundos
    // (medido: Opus 18 s frente a varios minutos con "high" sobre la misma tesela).
    effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('low'),
    // Lado de la tesela en píxeles de la imagen original y cuánto se amplía antes de enviarla.
    // 1024 x 2 = 2048 px: pocas teselas por foto y el animal de 10-20 px queda en 20-40 px.
    tile_px: z.number().int().min(128).max(MAX_IMAGE_SIDE_PX).default(1024),
    upscale: z.number().min(1).max(4).default(2),
    overlap: z.number().min(0).max(0.5).default(0.1),
    min_confidence: z.number().min(0).max(1).default(0.3),
    max_parallel_requests: z.number().int().min(1).max(32).default(16),
  })
  .strict()
  .refine((p) => p.tile_px * p.upscale <= MAX_IMAGE_SIDE_PX, {
    message: `tile_px * upscale must be <= ${MAX_IMAGE_SIDE_PX}`,
    path: ['tile_px'],
  });

type ClaudeVisionParams = z.infer<typeof ParamsSchema>;

export interface ClaudeVisionOptions {
  readonly apiKey: string | undefined;
  readonly name: string;
  readonly model: string;
  readonly label: string;
  readonly description: string;
  /** Solo para pruebas: reemplaza la red del SDK. */
  readonly fetch?: typeof fetch;
}

/** Un método por modelo de Anthropic (Opus, Sonnet): mismo código, distinto nombre y modelo. */
export class ClaudeVisionMethod implements DetectionMethodAdapter {
  readonly version = '0.3.0';
  readonly name: string;
  readonly label: string;
  readonly description: string;
  private client: Anthropic | undefined;

  constructor(private readonly options: ClaudeVisionOptions) {
    this.name = options.name;
    this.label = options.label;
    this.description = options.description;
  }

  get available(): boolean {
    return Boolean(this.options.apiKey);
  }

  resolveParams(params: DetectionParams | undefined): ClaudeVisionParams {
    return parseParams(ParamsSchema, this.name, { model: this.options.model, ...params });
  }

  async detect(
    image: Uint8Array,
    params: DetectionParams,
    signal: AbortSignal,
  ): Promise<RawDetectionOutput> {
    const p = this.resolveParams(params);
    const client = this.getClient();
    return detectInTiles(image, {
      tilePx: p.tile_px,
      upscale: p.upscale,
      overlap: p.overlap,
      minConfidence: p.min_confidence,
      maxParallelRequests: p.max_parallel_requests,
      signal,
      ask: (tile, tileSignal) => this.ask(client, tile, p, tileSignal),
    });
  }

  private async ask(
    client: Anthropic,
    tile: TileImage,
    p: ClaudeVisionParams,
    signal: AbortSignal,
  ): Promise<readonly TilePoint[]> {
    let response;
    try {
      response = await client.beta.messages.parse(
        {
          model: p.model,
          max_tokens: 16000,
          // Si el modelo declina la tesela, la API la reintenta con el modelo de respaldo que
          // Anthropic recomienda para ese caso, dentro de la misma llamada.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          thinking: { type: 'adaptive' },
          output_config: { effort: p.effort, format: betaZodOutputFormat(TileAnimalsSchema) },
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: tile.png.toString('base64'),
                  },
                },
                {
                  type: 'text',
                  text: `La imagen mide ${tile.width}x${tile.height} px. Marca cada animal.`,
                },
              ],
            },
          ],
        },
        { signal },
      );
    } catch (error) {
      throw toDetectorError(error, signal);
    }

    if (response.stop_reason === 'refusal') {
      throw new DetectorError('Claude declined to analyse the image');
    }
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      throw new DetectorError(`Claude returned no usable answer (${response.stop_reason})`);
    }
    return response.parsed_output.animals;
  }

  private getClient(): Anthropic {
    const { apiKey } = this.options;
    if (!apiKey) throw new DetectorError('ANTHROPIC_API_KEY is not configured');
    this.client ??= new Anthropic({
      apiKey,
      ...(this.options.fetch !== undefined && { fetch: this.options.fetch }),
    });
    return this.client;
  }
}

/** Errores del SDK → `DetectorError` legible. Una cancelación se relanza tal cual. */
function toDetectorError(error: unknown, signal: AbortSignal): unknown {
  if (signal.aborted) return signal.reason;
  if (error instanceof Anthropic.APIUserAbortError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new DetectorError('Claude rejected the API key (ANTHROPIC_API_KEY)', { cause: error });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new DetectorError(`Claude rate limit reached: ${error.message}`, { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new DetectorError(`Could not reach the Claude API: ${error.message}`, { cause: error });
  }
  if (error instanceof Anthropic.APIError) {
    return new DetectorError(`Claude API error ${error.status ?? ''}: ${error.message}`, {
      cause: error,
    });
  }
  // El SDK lanza AnthropicError si la respuesta no cumple el esquema de salida.
  return new DetectorError(`Claude returned an unusable answer: ${errorMessage(error)}`, {
    cause: error,
  });
}
