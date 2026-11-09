'use client';

import Image from 'next/image';
import { useActionState, type CSSProperties } from 'react';
import { LOGIN_HERD_MARKS } from '../assets/login-herd.marks';
import loginHerd from '../assets/login-herd.webp';
import { cornersPath } from '../assets/marks';
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
      <LoginVisor />

      <section className="login__panel" aria-labelledby="login-title">
        <div className="login__card">
          <BrandMark size={40} />
          <h1 id="login-title" className="login__title">
            Ingresar a HatoScan
          </h1>
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
      </section>
    </main>
  );
}

const { width: W, height: H, animals } = LOGIN_HERD_MARKS;
/** De la cabeza de la fila a la cola: el hato camina hacia el agua, a la izquierda. */
const HERD_ORDER = [...animals].sort((a, b) => b.x - a.x);
const FIRST_MARK_MS = 900;
const MARK_GAP_MS = 110;
const HUD_AT_MS = FIRST_MARK_MS + HERD_ORDER.length * MARK_GAP_MS + 250;
const at = (ms: number) => ({ '--at': `${ms}ms` }) as CSSProperties;

/**
 * Un potrero de ejemplo visto desde el dron: el modelo va marcando el hato en fila. Solo
 * decorativo; la foto es una ilustración generada (scripts/imagery.mjs).
 */
function LoginVisor() {
  return (
    <div className="login__visor" aria-hidden="true">
      <div className="login__stage">
        <Image
          src={loginHerd}
          alt=""
          fill
          className="login__photo"
          placeholder="blur"
          preload
          sizes="(max-width: 52rem) 100vw, 60vw"
        />
        <svg
          className="login__marks"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid slice"
          focusable="false"
        >
          {HERD_ORDER.map((box, i) => (
            <path
              key={`${box.x}-${box.y}`}
              className="login-mark"
              d={cornersPath(box, 12)}
              style={at(FIRST_MARK_MS + i * MARK_GAP_MS)}
            />
          ))}
        </svg>
      </div>
      <span className="viewfinder-corners login__corners" />
      <p className="login__hud" style={at(HUD_AT_MS)}>
        <strong>{HERD_ORDER.length}</strong> propuestas del modelo
        <span className="login__hud-tag">Ejemplo</span>
      </p>
    </div>
  );
}
