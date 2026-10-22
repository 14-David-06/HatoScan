import { describe, expect, it } from 'vitest';
import { toPersonId, type User } from '@/domain/index';
import { AirtableUserDirectory } from '../airtable/airtable-user-directory';
import { hashPassword, verifyPassword } from './scrypt-password-hasher';
import { SESSION_TTL_SECONDS, signSession, verifySession } from './session-token';

const USER: User = {
  id: toPersonId('SIRIUS-PER-0001'),
  name: 'Ana',
  nationalId: '1234567890',
  role: 'revisor',
};
const SECRET = 's'.repeat(32);

describe('scrypt password hasher', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('una clave larga');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('una clave larga', hash)).toBe(true);
    expect(await verifyPassword('otra clave', hash)).toBe(false);
    expect(await verifyPassword('una clave larga', 'basura')).toBe(false);
  });
});

describe('session token', () => {
  it('round-trips the user', async () => {
    const token = await signSession(USER, SECRET);
    expect(await verifySession(token, SECRET)).toEqual(USER);
  });

  it('rejects a tampered, foreign or expired token', async () => {
    const token = await signSession(USER, SECRET, 0);
    const [payload, signature] = token.split('.');
    expect(await verifySession(`${payload}x.${signature}`, SECRET, 0)).toBeUndefined();
    expect(await verifySession(token, 'o'.repeat(32), 0)).toBeUndefined();
    expect(await verifySession(token, SECRET, SESSION_TTL_SECONDS * 1000)).toBeUndefined();
    expect(await verifySession(undefined, SECRET)).toBeUndefined();
  });
});

describe('AirtableUserDirectory', () => {
  const record = {
    fields: {
      'ID Persona': 'SIRIUS-PER-0001',
      Nombre: 'Ana',
      Cédula: '1.234.567.890',
      'Hash contraseña': 'scrypt$x',
      Rol: 'revisor',
      Activo: true,
    },
  };
  const directory = (records: unknown[], seen: URL[] = []) =>
    new AirtableUserDirectory({
      apiToken: 't',
      baseId: 'appX',
      tableId: 'tblY',
      fetch: (async (url: URL) => {
        seen.push(url);
        return Response.json({ records });
      }) as typeof fetch,
    });

  it('maps the record and filters by the digits only', async () => {
    const seen: URL[] = [];
    const account = await directory([record], seen).findByNationalId("1234567890' OR 1");
    expect(seen[0]?.searchParams.get('filterByFormula')).toBe(
      "REGEX_REPLACE({Cédula} & '', '[^0-9]', '') = '12345678901'",
    );
    expect(account).toMatchObject({
      id: 'SIRIUS-PER-0001',
      nationalId: '1234567890',
      active: true,
    });
  });

  it('returns nothing for duplicated or malformed accounts', async () => {
    expect(await directory([record, record]).findByNationalId('1234567890')).toBeUndefined();
    const bad = { fields: { ...record.fields, 'ID Persona': 'ana' } };
    expect(await directory([bad]).findByNationalId('1234567890')).toBeUndefined();
  });
});
