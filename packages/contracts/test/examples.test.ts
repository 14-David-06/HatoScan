import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CountResultSchema } from '../src';

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));

describe('contracts', () => {
  it('acepta el ejemplo de CountResult', () => {
    expect(CountResultSchema.safeParse(load('count-result.example.json')).success).toBe(true);
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
