import { useEffect, useState } from 'react';

/** Tiempo transcurrido como `m:ss` (`0:07`, `3:42`, `12:05`). */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Milisegundos desde `startedAt` (marca de `Date.now()` tomada al iniciar la acción), actualizados
 * cada segundo. Con `startedAt` nulo devuelve 0 y no programa nada.
 */
export function useElapsedSince(startedAt: number | null): number {
  const [now, setNow] = useState<number | null>(null);
  const active = startedAt !== null;

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  if (startedAt === null || now === null) return 0;
  return Math.max(0, now - startedAt);
}
