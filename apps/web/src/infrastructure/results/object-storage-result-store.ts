import {
  CountResultSchema,
  ReviewResultSchema,
  type CountResult,
  type ReviewResult,
} from '@hatoscan/contracts';
import {
  countActive,
  toDetectorVersion,
  type CountId,
  type DetectionOutput,
  type DetectionResultStore,
  type ObjectStorage,
  type ReviewRecord,
  toCountId,
  toPersonId,
} from '@/domain/index';
import { toDomainDetection } from '../contracts-mapping';

const JSON_TYPE = 'application/json';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Guarda los JSON de detecciones junto a la imagen, con el formato de los contratos compartidos.
 * Claves: `counts/{id}/model-result.json` y `counts/{id}/review-result.json`.
 */
export class ObjectStorageResultStore implements DetectionResultStore {
  constructor(private readonly storage: ObjectStorage) {}

  async saveModelResult(countId: CountId, output: DetectionOutput): Promise<string> {
    const key = `counts/${countId}/model-result.json`;
    const document: CountResult = {
      conteo_id: countId,
      detector_version: output.detector.version,
      params: { ...output.params },
      params_hash: output.detector.paramsHash,
      image: output.image,
      detections: [...output.detections],
      total: countActive(output.detections),
      ...(output.processingMs !== undefined && { processing_ms: output.processingMs }),
    };
    await this.putJson(key, CountResultSchema.parse(document));
    return key;
  }

  async loadModelResult(key: string): Promise<DetectionOutput> {
    const result = CountResultSchema.parse(await this.getJson(key));
    return {
      detector: toDetectorVersion(result.detector_version, result.params_hash),
      params: result.params,
      image: result.image,
      detections: result.detections.map(toDomainDetection),
    };
  }

  async saveReview(review: ReviewRecord): Promise<string> {
    const key = `counts/${review.countId}/review-result.json`;
    const document: ReviewResult = {
      conteo_id: review.countId,
      reviewer_id: review.reviewerId,
      reviewed_at: review.reviewedAt.toISOString(),
      source_detector_version: review.sourceDetectorVersion,
      image: review.image,
      detections: [...review.detections],
      total: countActive(review.detections),
    };
    await this.putJson(key, ReviewResultSchema.parse(document));
    return key;
  }

  async loadReview(key: string): Promise<ReviewRecord> {
    const review = ReviewResultSchema.parse(await this.getJson(key));
    return {
      countId: toCountId(review.conteo_id),
      reviewerId: toPersonId(review.reviewer_id),
      reviewedAt: new Date(review.reviewed_at),
      sourceDetectorVersion: review.source_detector_version,
      image: review.image,
      detections: review.detections.map(toDomainDetection),
    };
  }

  private async getJson(key: string): Promise<unknown> {
    return JSON.parse(decoder.decode(await this.storage.get(key)));
  }

  private putJson(key: string, value: unknown): Promise<void> {
    return this.storage.put(key, encoder.encode(JSON.stringify(value)), JSON_TYPE);
  }
}
