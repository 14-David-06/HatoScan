import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/infrastructure/auth/session-token';

/**
 * Primera barrera: sin sesión válida no se entra a la app ni a la API de conteos. Las páginas y
 * los route handlers vuelven a comprobar la sesión (y el rol) por su cuenta.
 * `/api/files` queda fuera a propósito: el detector lee las imágenes con URLs firmadas, sin cookie.
 */
export async function proxy(request: NextRequest) {
  const secret = process.env.AUTH_SESSION_SECRET ?? '';
  const user =
    secret.length >= 32
      ? await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret)
      : undefined;
  if (user) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
  }
  const login = new URL('/ingresar', request.url);
  login.searchParams.set('next', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/conteos/:path*', '/api/counts/:path*'],
};
