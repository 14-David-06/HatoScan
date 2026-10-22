'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { RefreshIcon } from '../ui/icons';

const REFRESH_INTERVAL_MS = 4000;

/**
 * Mientras el detector trabaja, vuelve a pedir la página al servidor cada pocos segundos. Solo con
 * la pestaña visible: una pestaña olvidada no debe consultar el registro sin parar. Se desmonta sola
 * cuando el conteo sale de `procesando`, porque la pantalla deja de renderizarla.
 */
export function AutoRefresh({ intervalMs = REFRESH_INTERVAL_MS }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const timer = window.setInterval(refreshIfVisible, intervalMs);
    // Al volver a la pestaña se comprueba enseguida, sin esperar al siguiente intervalo.
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [router, intervalMs]);

  return (
    <p className="count-refresh">
      <RefreshIcon size={14} />
      Esta página se actualiza sola
    </p>
  );
}
