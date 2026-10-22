import { z } from 'zod';
import { USER_ROLES, toPersonId, type User } from '@/domain/index';

/**
 * Token de sesión firmado con HMAC-SHA256 (Web Crypto: funciona en el proxy y en el servidor).
 * Formato: `base64url(payload).base64url(firma)`. No es secreto, solo infalsificable: no lleva
 * nada que no pueda ver el propio usuario.
 */

export const SESSION_COOKIE = 'hatoscan_session';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const PayloadSchema = z.object({
  sub: z.string(),
  name: z.string(),
  nid: z.string(),
  role: z.enum(USER_ROLES),
  exp: z.number().int(),
});

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signSession(user: User, secret: string, now = Date.now()): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({
        sub: user.id,
        name: user.name,
        nid: user.nationalId,
        role: user.role,
        exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
      }),
    ),
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    await importKey(secret),
    encoder.encode(payload),
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Usuario del token, o `undefined` si falta, está alterado o venció. */
export async function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<User | undefined> {
  if (!token) return undefined;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return undefined;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await importKey(secret),
      fromBase64Url(signature),
      encoder.encode(payload),
    );
    if (!valid) return undefined;
    const parsed = PayloadSchema.safeParse(
      JSON.parse(new TextDecoder().decode(fromBase64Url(payload))),
    );
    if (!parsed.success || parsed.data.exp * 1000 <= now) return undefined;
    const { sub, name, nid, role } = parsed.data;
    return { id: toPersonId(sub), name, nationalId: nid, role };
  } catch {
    return undefined;
  }
}
