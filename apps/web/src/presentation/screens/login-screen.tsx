'use client';

import { useActionState } from 'react';
import { BrandMark } from '../ui/brand';
import { AlertTriangleIcon } from '../ui/icons';
import type { LoginState } from '../view-models';

export function LoginScreen({
  next,
  action,
}: {
  next: string;
  action: (previous: LoginState, form: FormData) => Promise<LoginState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <main className="login">
      <div className="login__card">
        <BrandMark size={40} />
        <h1 className="login__title">Ingresar a HatoScan</h1>
        <p className="login__lead">Usa tu número de cédula y la contraseña que te asignaron.</p>

        <form action={formAction} className="login__form" noValidate>
          <input type="hidden" name="next" value={next} />
          <label className="field">
            <span className="field__label">Número de cédula</span>
            <input
              name="nationalId"
              type="text"
              autoComplete="username"
              inputMode="numeric"
              placeholder="Sin puntos ni espacios"
              required
              defaultValue={state.nationalId}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? 'login-error' : undefined}
              autoFocus
            />
          </label>
          <label className="field">
            <span className="field__label">Contraseña</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? 'login-error' : undefined}
            />
          </label>

          {state.error && (
            <p id="login-error" className="callout callout--danger" role="alert">
              <AlertTriangleIcon size={18} />
              <span>{state.error}</span>
            </p>
          )}

          <button
            type="submit"
            className="button button--primary button--lg button--block"
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending && <span className="spinner" aria-hidden="true" />}
            Ingresar
          </button>
        </form>

        <p className="login__help">
          ¿No tienes acceso o olvidaste la contraseña? Pídelo al administrador de HatoScan.
        </p>
      </div>
    </main>
  );
}
