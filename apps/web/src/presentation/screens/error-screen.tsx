'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangleIcon, RefreshIcon } from '../ui/icons';

/**
 * Error inesperado al renderizar una página. En producción el mensaje del servidor no llega al
 * navegador (puede tener datos sensibles); el `digest` permite encontrarlo en los registros.
 */
export function ErrorScreen({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  /** Vuelve a pedir los datos y a renderizar el segmento. */
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page page--narrow">
      <section className="fallback" aria-labelledby="fallback-title">
        <span className="fallback__mark fallback__mark--danger" aria-hidden="true">
          <AlertTriangleIcon size={28} />
        </span>
        <h1 id="fallback-title" className="fallback__title">
          No se pudo cargar esta página
        </h1>
        <p className="fallback__text">
          Falló la lectura de los datos. Reintenta en unos segundos; si vuelve a pasar, avisa al
          equipo técnico.
        </p>
        <div className="fallback__actions">
          <button type="button" className="button button--primary" onClick={() => retry()}>
            <RefreshIcon size={16} />
            Reintentar
          </button>
          <Link href="/conteos" className="button">
            Ir a la lista de conteos
          </Link>
        </div>
        {error.digest && (
          <p className="fallback__digest">
            Código para el equipo técnico <span className="tag">{error.digest}</span>
          </p>
        )}
      </section>
    </main>
  );
}
