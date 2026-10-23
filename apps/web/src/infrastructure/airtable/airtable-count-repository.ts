import { z } from 'zod';
import {
  toCountId,
  type Count,
  type CountId,
  type CountIdGenerator,
  type CountRepository,
} from '@/domain/index';
import { StoredCountSchema, fromStored, toStored, type StoredCount } from '../counts/stored-count';

/** Nombres de las columnas de la tabla Conteos (ver CLAUDE.md §6). */
const F = {
  id: 'ID Conteo',
  farm: 'Finca',
  pasture: 'Potrero',
  species: 'Especie',
  status: 'Estado',
  flightDate: 'Fecha de vuelo',
  uploadedAt: 'Fecha de carga',
  modelTotal: 'Total modelo',
  reviewedTotal: 'Total revisado',
  detectorVersion: 'Versión detector',
  paramsHash: 'Hash parámetros',
  params: 'Parámetros',
  imageWidth: 'Ancho imagen (px)',
  imageHeight: 'Alto imagen (px)',
  reviewer: 'Revisor',
  reviewedAt: 'Fecha de revisión',
  imageKey: 'Clave imagen original',
  modelKey: 'Clave JSON modelo',
  reviewKey: 'Clave JSON revisado',
  altitude: 'Altura de vuelo (m)',
  cameraAngle: 'Ángulo de cámara (°)',
  notes: 'Observaciones',
  error: 'Mensaje de error',
} as const;

type Fields = Partial<Record<(typeof F)[keyof typeof F], unknown>>;

const PageSchema = z.object({
  records: z.array(z.object({ fields: z.record(z.unknown()) })),
  offset: z.string().optional(),
});

const COUNT_NUMBER = /^SIRIUS-CONTEO-(\d+)$/;

export interface AirtableCountRepositoryOptions {
  readonly apiToken: string;
  readonly baseId: string;
  readonly tableId: string;
  readonly fetch?: typeof fetch;
}

/**
 * Registro de conteos en la tabla Conteos de Airtable: una fila por conteo, nunca por animal, sin
 * binarios (solo las claves del almacenamiento de objetos). Misma forma de fila que el registro
 * JSON local (`StoredCount`).
 */
export class AirtableCountRepository implements CountRepository, CountIdGenerator {
  private queue: Promise<unknown> = Promise.resolve();
  /** Último número entregado por este proceso: evita repetirlo si aún no se ha guardado. */
  private lastIssued = 0;

  constructor(private readonly options: AirtableCountRepositoryOptions) {}

  async findById(id: CountId): Promise<Count | undefined> {
    const [fields] = await this.select({ filterByFormula: `{${F.id}} = '${id}'`, maxRecords: '2' });
    return fields ? fromStored(fromFields(fields)) : undefined;
  }

  async list(): Promise<readonly Count[]> {
    const rows = await this.select({});
    return rows
      .map((fields) => fromStored(fromFields(fields)))
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  /** Crea o actualiza la fila del conteo (upsert por «ID Conteo»). */
  async save(count: Count): Promise<void> {
    await this.request('PATCH', '', {
      performUpsert: { fieldsToMergeOn: [F.id] },
      typecast: false,
      records: [{ fields: toFields(toStored(count)) }],
    });
  }

  /**
   * Siguiente `SIRIUS-CONTEO-XXXX`: el mayor de la tabla + 1. Las llamadas de este proceso se
   * serializan; con varias instancias a la vez podría repetirse un número (pendiente si se escala).
   */
  next(): Promise<CountId> {
    const run = this.queue.then(async () => {
      const rows = await this.select({ 'fields[]': F.id });
      let max = this.lastIssued;
      for (const fields of rows) {
        const match = COUNT_NUMBER.exec(String(fields[F.id] ?? ''));
        if (match) max = Math.max(max, Number(match[1]));
      }
      this.lastIssued = max + 1;
      return toCountId(`SIRIUS-CONTEO-${String(this.lastIssued).padStart(4, '0')}`);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async select(params: Record<string, string>): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    let offset: string | undefined;
    do {
      const query = new URLSearchParams({ ...params, ...(offset && { offset }) });
      const page = PageSchema.parse(await this.request('GET', `?${query}`));
      rows.push(...page.records.map((r) => r.fields));
      offset = page.offset;
    } while (offset);
    return rows;
  }

  private async request(method: 'GET' | 'PATCH', suffix: string, body?: unknown): Promise<unknown> {
    const { apiToken, baseId, tableId } = this.options;
    const doFetch = this.options.fetch ?? fetch;
    const response = await doFetch(`https://api.airtable.com/v0/${baseId}/${tableId}${suffix}`, {
      method,
      headers: {
        authorization: `Bearer ${apiToken}`,
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      cache: 'no-store',
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Airtable Conteos responded ${response.status}: ${detail}`);
    }
    return response.json();
  }
}

/** Fila del dominio → columnas. Lo que no aplica va en `null` para limpiar la celda al actualizar. */
export function toFields(s: StoredCount): Fields {
  return {
    [F.id]: s.id,
    [F.farm]: s.farm || null,
    [F.pasture]: s.pastureId,
    [F.species]: s.species,
    [F.status]: s.status,
    [F.flightDate]: s.flightDate.slice(0, 10),
    [F.uploadedAt]: s.uploadedAt,
    [F.imageKey]: s.originalImageKey,
    [F.altitude]: s.flight.altitudeM ?? null,
    [F.cameraAngle]: s.flight.cameraAngleDeg ?? null,
    [F.notes]: s.flight.notes ?? null,
    [F.modelTotal]: s.model?.total ?? null,
    [F.detectorVersion]: s.model?.detectorVersion ?? null,
    [F.paramsHash]: s.model?.paramsHash ?? null,
    [F.params]: s.model ? JSON.stringify(s.model.params) : null,
    [F.imageWidth]: s.model?.image.width ?? null,
    [F.imageHeight]: s.model?.image.height ?? null,
    [F.modelKey]: s.model?.resultKey ?? null,
    [F.reviewer]: s.review?.reviewerId ?? null,
    [F.reviewedAt]: s.review?.reviewedAt ?? null,
    [F.reviewedTotal]: s.review?.total ?? null,
    [F.reviewKey]: s.review?.resultKey ?? null,
    [F.error]: s.errorMessage ?? null,
  };
}

/** Columnas → fila del dominio, validada con Zod (Airtable omite las celdas vacías). */
export function fromFields(fields: Record<string, unknown>): StoredCount {
  const has = (name: string) =>
    fields[name] !== undefined && fields[name] !== null && fields[name] !== '';
  const flightDate = String(fields[F.flightDate] ?? '');
  return StoredCountSchema.parse({
    id: fields[F.id],
    ...(has(F.farm) && { farm: fields[F.farm] }),
    pastureId: fields[F.pasture],
    species: fields[F.species],
    status: fields[F.status],
    // Fecha civil del vuelo, a mediodía UTC como la guarda la app (no cambia de día por zona).
    flightDate: /^\d{4}-\d{2}-\d{2}$/.test(flightDate) ? `${flightDate}T12:00:00.000Z` : flightDate,
    uploadedAt: fields[F.uploadedAt],
    originalImageKey: fields[F.imageKey],
    flight: {
      ...(has(F.altitude) && { altitudeM: fields[F.altitude] }),
      ...(has(F.cameraAngle) && { cameraAngleDeg: fields[F.cameraAngle] }),
      ...(has(F.notes) && { notes: fields[F.notes] }),
    },
    ...(has(F.detectorVersion) && {
      model: {
        detectorVersion: fields[F.detectorVersion],
        paramsHash: fields[F.paramsHash],
        params: JSON.parse(String(fields[F.params] ?? '{}')) as unknown,
        image: { width: fields[F.imageWidth], height: fields[F.imageHeight] },
        total: fields[F.modelTotal],
        resultKey: fields[F.modelKey],
      },
    }),
    ...(has(F.reviewer) && {
      review: {
        reviewerId: fields[F.reviewer],
        reviewedAt: fields[F.reviewedAt],
        total: fields[F.reviewedTotal],
        resultKey: fields[F.reviewKey],
      },
    }),
    ...(has(F.error) && { errorMessage: fields[F.error] }),
  });
}
