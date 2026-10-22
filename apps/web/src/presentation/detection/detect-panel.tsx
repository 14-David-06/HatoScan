'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '../ui/confirm-dialog';
import { AlertTriangleIcon, RefreshIcon, ScanIcon } from '../ui/icons';
import type { DetectionMethodsView } from '../view-models';
import { formatElapsed, useElapsedSince } from './elapsed';
import { MethodSelect, useMethod } from './method-select';

export type DetectMode = 'first' | 'retry' | 'again';

const BUTTON_LABELS: Readonly<Record<DetectMode, string>> = {
  first: 'Ejecutar detección',
  retry: 'Reintentar detección',
  again: 'Volver a detectar',
};

/** Ejecuta la detección de un conteo con el método elegido. El resultado se ve al refrescar. */
export function DetectPanel({
  countId,
  catalog,
  mode,
}: {
  countId: string;
  catalog: DetectionMethodsView;
  mode: DetectMode;
}) {
  const router = useRouter();
  const [method, setMethod] = useMethod(catalog);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, dialog] = useConfirm();
  const elapsed = useElapsedSince(startedAt);
  const running = startedAt !== null;

  const run = async () => {
    if (running) return;
    if (
      mode === 'again' &&
      !(await confirm({
        title: '¿Volver a detectar?',
        body: (
          <p>
            La propuesta actual se conserva en el historial, pero se perderán las marcas que no
            hayas confirmado.
          </p>
        ),
        confirmLabel: 'Volver a detectar',
        tone: 'danger',
      }))
    ) {
      return;
    }
    setStartedAt(Date.now());
    setError(null);
    try {
      const response = await fetch(`/api/counts/${countId}/process`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(method ? { detector: method } : {}),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Error ${response.status}`);
      }
      router.refresh();
    } catch {
      setError('No se pudo conectar con el servidor. Revisa la red y vuelve a intentarlo.');
    } finally {
      setStartedAt(null);
    }
  };

  const Icon = mode === 'first' ? ScanIcon : RefreshIcon;

  return (
    <div className={`detect-panel detect-panel--${mode}`}>
      <MethodSelect catalog={catalog} value={method} onChange={setMethod} disabled={running} />
      <div className="detect-panel__actions">
        <button
          type="button"
          className={mode === 'again' ? 'button' : 'button button--primary'}
          onClick={run}
          aria-busy={running}
          disabled={!running && catalog !== null && method === ''}
        >
          {running ? <span className="spinner" aria-hidden="true" /> : <Icon size={16} />}
          {BUTTON_LABELS[mode]}
        </button>
        {running && (
          <p className="detect-panel__status" aria-hidden="true">
            Detectando animales
            <span className="detect-panel__elapsed">{formatElapsed(elapsed)}</span>
          </p>
        )}
      </div>
      {/* Montada desde el inicio: una región viva que aparece ya con texto no siempre se anuncia. */}
      <p className="visually-hidden" role="status">
        {running ? 'Detectando animales.' : ''}
      </p>
      {running && (
        <p className="detect-panel__note">
          Según el método, la detección puede tardar unos minutos. Mantén esta página abierta.
        </p>
      )}
      {error && (
        <div className="callout callout--danger" role="alert">
          <AlertTriangleIcon size={16} />
          <p>{error}</p>
        </div>
      )}
      {dialog}
    </div>
  );
}
