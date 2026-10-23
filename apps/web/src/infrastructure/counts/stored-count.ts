import { z } from 'zod';
import {
  COUNT_STATUSES,
  Count,
  SPECIES,
  toCountId,
  toDetectorVersion,
  toPersonId,
  type CountProps,
} from '@/domain/index';

/**
 * Forma de fila de un conteo en un registro externo (archivo JSON local o Airtable): una fila por
 * conteo, fechas en ISO, sin binarios (solo claves del almacenamiento).
 */
const ImageSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const StoredCountSchema = z.object({
  id: z.string(),
  /** Los conteos guardados antes de existir la finca no la traen. */
  farm: z.string().default(''),
  pastureId: z.string(),
  species: z.enum(SPECIES),
  flightDate: z.string().datetime(),
  uploadedAt: z.string().datetime(),
  flight: z.object({
    altitudeM: z.number().positive().optional(),
    cameraAngleDeg: z.number().min(0).max(90).optional(),
    notes: z.string().optional(),
  }),
  originalImageKey: z.string().min(1),
  status: z.enum(COUNT_STATUSES),
  model: z
    .object({
      detectorVersion: z.string(),
      paramsHash: z.string(),
      params: z.record(z.unknown()),
      image: ImageSchema,
      total: z.number().int().nonnegative(),
      resultKey: z.string(),
    })
    .optional(),
  review: z
    .object({
      reviewerId: z.string(),
      reviewedAt: z.string().datetime(),
      total: z.number().int().nonnegative(),
      resultKey: z.string(),
    })
    .optional(),
  errorMessage: z.string().optional(),
});

export type StoredCount = z.infer<typeof StoredCountSchema>;

export function toStored(count: Count): StoredCount {
  const p = count.toProps();
  return {
    id: p.id,
    farm: p.farm,
    pastureId: p.pastureId,
    species: p.species,
    flightDate: p.flightDate.toISOString(),
    uploadedAt: p.uploadedAt.toISOString(),
    flight: { ...p.flight },
    originalImageKey: p.originalImageKey,
    status: p.status,
    ...(p.model && {
      model: {
        detectorVersion: p.model.detector.version,
        paramsHash: p.model.detector.paramsHash,
        params: { ...p.model.params },
        image: p.model.image,
        total: p.model.total,
        resultKey: p.model.resultKey,
      },
    }),
    ...(p.review && {
      review: {
        reviewerId: p.review.reviewerId,
        reviewedAt: p.review.reviewedAt.toISOString(),
        total: p.review.total,
        resultKey: p.review.resultKey,
      },
    }),
    ...(p.errorMessage !== undefined && { errorMessage: p.errorMessage }),
  };
}

export function fromStored(s: StoredCount): Count {
  const { altitudeM, cameraAngleDeg, notes } = s.flight;
  const props: CountProps = {
    id: toCountId(s.id),
    farm: s.farm,
    pastureId: s.pastureId,
    species: s.species,
    flightDate: new Date(s.flightDate),
    uploadedAt: new Date(s.uploadedAt),
    flight: {
      ...(altitudeM !== undefined && { altitudeM }),
      ...(cameraAngleDeg !== undefined && { cameraAngleDeg }),
      ...(notes !== undefined && { notes }),
    },
    originalImageKey: s.originalImageKey,
    status: s.status,
    ...(s.model && {
      model: {
        detector: toDetectorVersion(s.model.detectorVersion, s.model.paramsHash),
        params: s.model.params,
        image: s.model.image,
        total: s.model.total,
        resultKey: s.model.resultKey,
      },
    }),
    ...(s.review && {
      review: {
        reviewerId: toPersonId(s.review.reviewerId),
        reviewedAt: new Date(s.review.reviewedAt),
        total: s.review.total,
        resultKey: s.review.resultKey,
      },
    }),
    ...(s.errorMessage !== undefined && { errorMessage: s.errorMessage }),
  };
  return Count.restore(props);
}
