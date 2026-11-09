import { describe, expect, it } from 'vitest';
import type { Detection } from '@/domain/index';
import { bogotaDay } from './bogota-day';
import { detectionsSignature, reviewKey } from './review-key';

const mark = (
  id: string,
  x: number,
  y: number,
  estado: Detection['estado'] = 'activa',
): Detection => ({
  id,
  x,
  y,
  tipo: 'punto',
  origen: 'modelo',
  estado,
});

describe('reviewKey', () => {
  const proposal = [mark('d1', 10, 20), mark('d2', 30, 40)];

  it('is stable for the same proposal', () => {
    const a = reviewKey({
      status: 'pendiente_revision',
      detectorVersion: 'claude-vision@0.3.0',
      detections: proposal,
    });
    const b = reviewKey({
      status: 'pendiente_revision',
      detectorVersion: 'claude-vision@0.3.0',
      detections: proposal.map((d) => ({ ...d })),
    });
    expect(a).toBe(b);
  });

  it('changes when detecting again yields another proposal with the same status', () => {
    const before = reviewKey({
      status: 'pendiente_revision',
      detectorVersion: 'claude-vision@0.3.0',
      detections: proposal,
    });
    const otherMethod = reviewKey({
      status: 'pendiente_revision',
      detectorVersion: 'yolo11s-sahi@0.3.0',
      detections: proposal,
    });
    const otherMarks = reviewKey({
      status: 'pendiente_revision',
      detectorVersion: 'claude-vision@0.3.0',
      detections: [mark('d1', 10, 20), mark('d2', 31, 40)],
    });
    expect(otherMethod).not.toBe(before);
    expect(otherMarks).not.toBe(before);
  });

  it('changes with the status', () => {
    expect(reviewKey({ status: 'revisado', detections: proposal })).not.toBe(
      reviewKey({ status: 'pendiente_revision', detections: proposal }),
    );
  });
});

describe('detectionsSignature', () => {
  it('distinguishes order, discarded marks and empty proposals', () => {
    const a = [mark('d1', 1, 2), mark('d2', 3, 4)];
    expect(detectionsSignature(a)).not.toBe(detectionsSignature([...a].reverse()));
    expect(detectionsSignature(a)).not.toBe(
      detectionsSignature([mark('d1', 1, 2), mark('d2', 3, 4, 'descartada')]),
    );
    expect(detectionsSignature([])).toMatch(/^0-/);
  });
});

describe('bogotaDay', () => {
  it('converts a UTC instant to the calendar day in Bogotá (UTC−5)', () => {
    expect(bogotaDay('2026-10-06T01:30:00.000Z')).toBe('2026-10-05');
    expect(bogotaDay('2026-10-05T05:00:00.000Z')).toBe('2026-10-05');
    expect(bogotaDay('2026-10-05T04:59:59.000Z')).toBe('2026-10-04');
  });

  it('returns the input when it is not a date', () => {
    expect(bogotaDay('ayer')).toBe('ayer');
  });
});
