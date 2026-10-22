import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { PasswordHasher } from '@/domain/index';

// Sin propiedades de parámetro ni alias: scripts/hash-password.ts importa este archivo con el
// recorte de tipos de Node, que solo admite TypeScript "borrable".

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

/** Hash para guardar en Airtable: `scrypt$N$r$p$salt$hash` (sal y hash en base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await derive(password, Buffer.from(salt, 'base64url'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  }).catch(() => undefined);
  return key !== undefined && key.length === expected.length && timingSafeEqual(key, expected);
}

export class ScryptPasswordHasher implements PasswordHasher {
  verify(password: string, passwordHash: string): Promise<boolean> {
    return verifyPassword(password, passwordHash);
  }
}
