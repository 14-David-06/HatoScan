'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { SPECIES, type Species } from '@/domain/index';
import { SPECIES_LABELS } from '../view-models';

type Phase = 'idle' | 'uploading' | 'detecting';

const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  idle: 'Subir y detectar',
  uploading: 'Subiendo imagen…',
  detecting: 'Detectando animales…',
};

export function NewCountScreen({ today }: { today: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    setPhase('uploading');
    let id: string;
    try {
      const response = await fetch('/api/counts', { method: 'POST', body: form });
      const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !body.id) throw new Error(body.error ?? `Error ${response.status}`);
      id = body.id;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo subir la imagen.');
      setPhase('idle');
      return;
    }

    // Si la detección falla, el conteo queda en `error` y la pantalla del conteo lo muestra.
    setPhase('detecting');
    await fetch(`/api/counts/${id}/process`, { method: 'POST' }).catch(() => undefined);
    router.push(`/conteos/${id}`);
  };

  const busy = phase !== 'idle';

  return (
    <main className="page page--narrow">
      <p>
        <Link href="/">← Conteos</Link>
      </p>
      <h1>Nuevo conteo</h1>
      <p className="muted">
        Sube la foto original del dron, sin recortar ni reducir: los animales miden 10–20 px y el
        detector necesita la resolución completa.
      </p>

      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span>Foto aérea (JPG, PNG o TIFF)</span>
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/tiff"
            required
            disabled={busy}
          />
        </label>

        <div className="form__row">
          <label className="field">
            <span>Potrero</span>
            <input name="pastureId" required placeholder="Ej. Potrero 12" disabled={busy} />
          </label>
          <label className="field">
            <span>Especie</span>
            <select name="species" defaultValue={'bufala' satisfies Species} disabled={busy}>
              {SPECIES.map((s) => (
                <option key={s} value={s}>
                  {SPECIES_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Fecha de vuelo</span>
            <input name="flightDate" type="date" required max={today} disabled={busy} />
          </label>
        </div>

        <fieldset className="form__group" disabled={busy}>
          <legend>Metadatos de vuelo (opcional)</legend>
          <div className="form__row">
            <label className="field">
              <span>Altura (m)</span>
              <input name="altitudeM" type="number" min="1" step="any" inputMode="decimal" />
            </label>
            <label className="field">
              <span>Ángulo de cámara (°, 90 = cenital)</span>
              <input name="cameraAngleDeg" type="number" min="0" max="90" step="any" />
            </label>
          </div>
          <label className="field">
            <span>Observaciones</span>
            <textarea name="notes" rows={3} maxLength={1000} />
          </label>
        </fieldset>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={busy}>
          {PHASE_LABELS[phase]}
        </button>
      </form>
    </main>
  );
}
