'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DetectionMethodsView } from '../view-models';
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
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (
      mode === 'again' &&
      !window.confirm(
        'La propuesta actual dejará de estar vigente (se conserva en el historial) y se perderán ' +
          'las marcas que no hayas confirmado. ¿Volver a detectar?',
      )
    ) {
      return;
    }
    setRunning(true);
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
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="detect-panel">
      <MethodSelect catalog={catalog} value={method} onChange={setMethod} disabled={running} />
      <button
        type="button"
        className={mode === 'again' ? 'button' : 'button button--primary'}
        onClick={run}
        disabled={running || (catalog !== null && method === '')}
      >
        {running ? 'Detectando animales…' : BUTTON_LABELS[mode]}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
