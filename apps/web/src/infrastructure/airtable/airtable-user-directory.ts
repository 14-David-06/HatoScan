import { z } from 'zod';
import {
  USER_ROLES,
  normalizeNationalId,
  toPersonId,
  type UserAccount,
  type UserDirectory,
} from '@/domain/index';

const RecordSchema = z.object({
  fields: z.object({
    'ID Persona': z
      .string()
      .trim()
      .regex(/^SIRIUS-PER-\d{4,}$/),
    Nombre: z.string().default(''),
    Cédula: z.string().transform(normalizeNationalId),
    'Hash contraseña': z.string().default(''),
    Rol: z.enum(USER_ROLES).default('lector'),
    Activo: z.boolean().default(false),
  }),
});

const ResponseSchema = z.object({ records: z.array(z.unknown()) });

export interface AirtableUserDirectoryOptions {
  readonly apiToken: string;
  readonly baseId: string;
  readonly tableId: string;
  readonly fetch?: typeof fetch;
}

/** Lee la tabla Usuarios de Airtable. Solo lectura: las cuentas se administran en Airtable. */
export class AirtableUserDirectory implements UserDirectory {
  constructor(private readonly options: AirtableUserDirectoryOptions) {}

  async findByNationalId(nationalId: string): Promise<UserAccount | undefined> {
    const { apiToken, baseId, tableId } = this.options;
    const doFetch = this.options.fetch ?? fetch;
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    // Solo dígitos: nada que escapar en la fórmula. La celda puede tener puntos o espacios.
    const digits = normalizeNationalId(nationalId);
    if (!digits) return undefined;
    url.searchParams.set(
      'filterByFormula',
      `REGEX_REPLACE({Cédula} & '', '[^0-9]', '') = '${digits}'`,
    );
    url.searchParams.set('maxRecords', '2');

    const response = await doFetch(url, {
      headers: { authorization: `Bearer ${apiToken}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Airtable Usuarios responded ${response.status}`);
    const { records } = ResponseSchema.parse(await response.json());
    // Una cédula repetida es un error de datos: no se adivina cuál cuenta usar.
    if (records.length !== 1) return undefined;

    const parsed = RecordSchema.safeParse(records[0]);
    if (!parsed.success) return undefined;
    const f = parsed.data.fields;
    return {
      id: toPersonId(f['ID Persona']),
      name: f.Nombre.trim() || f['ID Persona'],
      nationalId: f.Cédula,
      role: f.Rol,
      active: f.Activo,
      passwordHash: f['Hash contraseña'].trim(),
    };
  }
}
