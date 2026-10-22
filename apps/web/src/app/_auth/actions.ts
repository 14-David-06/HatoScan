'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { InvalidCredentialsError } from '@/application/errors';
import { getContainer } from '@/composition/container';
import { normalizeNationalId } from '@/domain/index';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/infrastructure/auth/session-token';
import type { LoginState } from '@/presentation/view-models';
import { safeNext } from './session';

export async function login(_previous: LoginState, form: FormData): Promise<LoginState> {
  const nationalId = String(form.get('nationalId') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = safeNext(form.get('next'));
  if (!nationalId || !password) {
    return { error: 'Escribe tu número de cédula y tu contraseña.', nationalId };
  }

  const container = getContainer();
  const attempt = { nationalId: normalizeNationalId(nationalId), ip: await clientIp() };
  if (!container.loginAttempts.isAllowed(attempt)) {
    return { error: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.', nationalId };
  }

  let token: string;
  try {
    const user = await container.authenticateUser.execute({ nationalId, password });
    token = await container.sessions.sign(user);
    container.loginAttempts.recordSuccess(attempt);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      container.loginAttempts.recordFailure(attempt);
      return { error: 'Cédula o contraseña incorrectas.', nationalId };
    }
    console.error(error);
    return { error: 'No se pudo verificar tu cuenta. Intenta de nuevo en un momento.', nationalId };
  }

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect(next);
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/');
}

/** IP del cliente según el proxy (Vercel pone `x-forwarded-for`); en local, vacía. */
async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() ?? '';
}
