'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Lanza la detección de un conteo `subido`. El resultado (o el error) se ve al refrescar. */
export function ProcessButton({ countId }: { countId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/counts/${countId}/process`, { method: 'POST' });
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
    <>
      <button type="button" className="button button--primary" onClick={run} disabled={running}>
        {running ? 'Detectando animales…' : 'Ejecutar detección'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
