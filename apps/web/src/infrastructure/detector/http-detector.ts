import { CountResultSchema, DetectorCatalogSchema, type DetectRequest } from '@hatoscan/contracts';
import {
  countActive,
  toDetectorVersion,
  type DetectInput,
  type DetectionMethodCatalog,
  type DetectionOutput,
  type Detector,
} from '@/domain/index';
import { toDomainDetection } from '../contracts-mapping';

export class DetectorServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DetectorServiceError';
  }
}

export interface HttpDetectorOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  /** Token para `Authorization: Bearer`: el secreto compartido con el detector. */
  readonly getAuthToken?: () => Promise<string>;
  readonly fetch?: typeof fetch;
}

/** Cliente HTTP del servicio de detección (FastAPI, proyecto Vercel aparte; ADR 0006). */
export class HttpDetector implements Detector {
  constructor(private readonly options: HttpDetectorOptions) {}

  async detect(input: DetectInput): Promise<DetectionOutput> {
    const { baseUrl, timeoutMs } = this.options;
    const doFetch = this.options.fetch ?? fetch;

    const body: DetectRequest = {
      conteo_id: input.countId,
      image_url: input.imageUrl,
      ...(input.detector !== undefined && { detector: input.detector }),
      ...(input.params !== undefined && { params: { ...input.params } }),
    };
    const response = await doFetch(`${baseUrl}/v1/detect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await this.authHeaders()) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new DetectorServiceError(
        `Detector responded ${response.status}: ${detail.slice(0, 500)}`,
      );
    }

    const parsed = CountResultSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new DetectorServiceError(`Invalid detector response: ${parsed.error.message}`);
    }
    const result = parsed.data;
    if (result.conteo_id !== input.countId) {
      throw new DetectorServiceError(
        `Detector answered for ${result.conteo_id}, expected ${input.countId}`,
      );
    }

    const detections = result.detections.map(toDomainDetection);
    if (countActive(detections) !== result.total) {
      throw new DetectorServiceError(
        `Detector total ${result.total} does not match ${countActive(detections)} active detections`,
      );
    }

    return {
      detector: toDetectorVersion(result.detector_version, result.params_hash),
      params: result.params,
      image: result.image,
      detections,
      ...(result.processing_ms !== undefined && { processingMs: result.processing_ms }),
    };
  }

  async methods(): Promise<DetectionMethodCatalog> {
    const doFetch = this.options.fetch ?? fetch;
    const response = await doFetch(`${this.options.baseUrl}/v1/detectors`, {
      headers: await this.authHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new DetectorServiceError(`Detector catalog responded ${response.status}`);
    }
    const parsed = DetectorCatalogSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new DetectorServiceError(`Invalid detector catalog: ${parsed.error.message}`);
    }
    return {
      defaultMethod: parsed.data.default_detector,
      methods: parsed.data.detectors.map((d) => ({ ...d })),
    };
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const { getAuthToken } = this.options;
    return getAuthToken ? { authorization: `Bearer ${await getAuthToken()}` } : {};
  }
}
