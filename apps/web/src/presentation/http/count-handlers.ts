import { DetectionSchema, type Detection as DetectionContract } from '@hatoscan/contracts';
import { z } from 'zod';
import { ApplicationError, CountNotFoundError } from '@/application/errors';
import type { ProcessCount } from '@/application/count/process-count';
import type { RegisterCount } from '@/application/count/register-count';
import type { ReviewCount } from '@/application/count/review-count';
import { DomainError, SPECIES, toCountId, type Detection, type PersonId } from '@/domain/index';

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());

const NewCountFormSchema = z.object({
  farm: z.string().trim().min(1, 'La finca es obligatoria').max(100),
  pastureId: z.string().trim().min(1, 'El potrero es obligatorio'),
  species: z.enum(SPECIES),
  flightDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de vuelo inválida (AAAA-MM-DD)'),
  altitudeM: optionalNumber(z.coerce.number().positive()),
  cameraAngleDeg: optionalNumber(z.coerce.number().min(0).max(90)),
  notes: z.string().trim().max(1000).optional(),
});

const ProcessBodySchema = z.object({
  detector: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .optional(),
});

const ReviewBodySchema = z.object({
  detections: z.array(DetectionSchema),
});

/** `POST /api/counts` (multipart): registra un conteo con su imagen original. */
export function createCountHandler(registerCount: RegisterCount) {
  return (request: Request): Promise<Response> =>
    respond(async () => {
      const form = await request.formData();
      const image = form.get('image');
      if (!(image instanceof File) || image.size === 0) {
        return problem(400, 'Adjunta la foto aérea original.');
      }
      const fields = NewCountFormSchema.parse({
        farm: form.get('farm'),
        pastureId: form.get('pastureId'),
        species: form.get('species'),
        flightDate: form.get('flightDate'),
        altitudeM: form.get('altitudeM'),
        cameraAngleDeg: form.get('cameraAngleDeg'),
        notes: form.get('notes') ?? undefined,
      });

      const count = await registerCount.execute({
        farm: fields.farm,
        pastureId: fields.pastureId,
        species: fields.species,
        // Fecha civil del vuelo, guardada a mediodía UTC para que no cambie de día por zona horaria.
        flightDate: new Date(`${fields.flightDate}T12:00:00Z`),
        flight: {
          ...(fields.altitudeM !== undefined && { altitudeM: fields.altitudeM }),
          ...(fields.cameraAngleDeg !== undefined && { cameraAngleDeg: fields.cameraAngleDeg }),
          ...(fields.notes && { notes: fields.notes }),
        },
        image: { bytes: new Uint8Array(await image.arrayBuffer()), contentType: image.type },
      });
      return Response.json({ id: count.id, status: count.status }, { status: 201 });
    });
}

/**
 * `POST /api/counts/{id}/process` (JSON opcional `{ detector }`): corre el método elegido, o el
 * predeterminado del servicio. Un fallo deja el conteo en `error`.
 */
export function processCountHandler(processCount: ProcessCount) {
  return (request: Request, id: string): Promise<Response> =>
    respond(async () => {
      const text = await request.text();
      const body = ProcessBodySchema.parse(text.trim() === '' ? {} : JSON.parse(text));
      const count = await processCount.execute({
        countId: toCountId(id),
        ...(body.detector !== undefined && { detector: body.detector }),
      });
      return Response.json({
        id: count.id,
        status: count.status,
        ...(count.errorMessage !== undefined && { errorMessage: count.errorMessage }),
      });
    });
}

/**
 * `POST /api/counts/{id}/review` (JSON `{ detections }`): registra la revisión humana. El revisor
 * es el usuario de la sesión, nunca un dato del cuerpo.
 */
export function reviewCountHandler(reviewCount: ReviewCount) {
  return (request: Request, id: string, reviewerId: PersonId): Promise<Response> =>
    respond(async () => {
      const body = ReviewBodySchema.parse(await request.json());
      const count = await reviewCount.execute({
        countId: toCountId(id),
        reviewerId,
        detections: body.detections.map(toDomainDetection),
      });
      return Response.json({ id: count.id, status: count.status, total: count.officialTotal });
    });
}

async function respond(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return problem(400, error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    }
    if (error instanceof SyntaxError) return problem(400, 'JSON inválido');
    if (error instanceof CountNotFoundError) return problem(404, error.message);
    if (error instanceof DomainError || error instanceof ApplicationError) {
      return problem(422, error.message);
    }
    console.error(error);
    return problem(500, 'Error interno');
  }
}

function problem(status: number, detail: string): Response {
  return Response.json({ error: detail }, { status });
}

/** Zod tipa los opcionales como `T | undefined`; el dominio no admite `undefined` explícito. */
function toDomainDetection(d: DetectionContract): Detection {
  return {
    id: d.id,
    x: d.x,
    y: d.y,
    tipo: d.tipo,
    origen: d.origen,
    estado: d.estado,
    ...(d.w !== undefined && { w: d.w }),
    ...(d.h !== undefined && { h: d.h }),
    ...(d.score !== undefined && { score: d.score }),
  };
}
