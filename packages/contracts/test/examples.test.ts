import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CountResultSchema, ReviewResultSchema } from '../src';

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));

describe('contracts', () => {
  it('acepta el ejemplo de CountResult', () => {
    expect(CountResultSchema.safeParse(load('count-result.example.json')).success).toBe(true);
  });

  it('acepta una revisión derivada del ejemplo', () => {
    const { conteo_id, detector_version, image, detections } = load(
      'count-result.example.json',
    ) as {
      conteo_id: string;
      detector_version: string;
      image: unknown;
      detections: unknown[];
    };
    const review = {
      conteo_id,
      reviewer_id: 'SIRIUS-PER-0001',
      reviewed_at: '2026-11-09T15:00:00Z',
      source_detector_version: detector_version,
      image,
      detections,
      total: 1,
    };
    expect(ReviewResultSchema.safeParse(review).success).toBe(true);
  });

  it('rechaza coordenadas negativas', () => {
    const example = load('count-result.example.json') as { detections: { x: number }[] };
    example.detections[0]!.x = -1;
    expect(CountResultSchema.safeParse(example).success).toBe(false);
  });

  it('rechaza campos desconocidos en una detección', () => {
    const example = load('count-result.example.json') as { detections: Record<string, unknown>[] };
    example.detections[0]!['extra'] = true;
    expect(CountResultSchema.safeParse(example).success).toBe(false);
  });
});
