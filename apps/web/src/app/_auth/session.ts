import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getContainer } from '@/composition/container';
import { canReview, type User } from '@/domain/index';
import { SESSION_COOKIE } from '@/infrastructure/auth/session-token';

/** Usuario de la cookie de sesión, o `undefined`. */
export async function currentUser(): Promise<User | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getContainer().sessions.verify(token);
}

/** Para páginas: sin sesión, manda a ingresar y vuelve a `next` después. */
export async function requireUser(next: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(next)}`);
  return user;
}

/**
 * Para route handlers que cambian datos: el proxy ya filtra sin sesión, pero aquí se verifica de
 * nuevo y además el rol. Devuelve el usuario o la respuesta de error lista para enviar.
 */
export async function authorizeReviewer(): Promise<User | Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
  if (!canReview(user)) {
    return Response.json(
      { error: 'Tu rol es lector: no puedes cambiar conteos.' },
      { status: 403 },
    );
  }
  return user;
}

/** Solo rutas internas: evita redirecciones abiertas a otro dominio. */
export function safeNext(value: unknown, fallback = '/conteos'): string {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : fallback;
}
