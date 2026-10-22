'use client';

import { useState, type CSSProperties } from 'react';
import type { ImageSize } from '@/domain/index';

/**
 * La foto del conteo en el visor oscuro, a resolución completa. La URL firmada cambia en cada render
 * del servidor (lleva su caducidad); se conserva la primera mientras apunte al mismo archivo para que
 * el auto-refresco no vuelva a descargar una foto de decenas de MB cada pocos segundos.
 */
export function CountPhoto({
  src,
  alt,
  size,
  scanning = false,
}: {
  src: string;
  alt: string;
  /** Tamaño original, si ya se conoce: el visor reserva su proporción antes de que llegue la foto. */
  size?: ImageSize | undefined;
  /** Barrido de escaneo encima de la foto: el detector está trabajando sobre ella. */
  scanning?: boolean;
}) {
  const [shown, setShown] = useState(src);
  if (shown !== src && filePath(shown) !== filePath(src)) setShown(src);

  const style = size
    ? ({ '--count-photo-ratio': `${size.width} / ${size.height}` } as CSSProperties)
    : undefined;

  return (
    <figure
      className={scanning ? 'count-photo count-photo--scanning' : 'count-photo'}
      style={style}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image reescalaría la foto; la revisión exige resolución completa. */}
      <img
        className="count-photo__img"
        src={shown}
        alt={alt}
        decoding="async"
        fetchPriority="high"
      />
      {/* Siempre presente y oculto: se muestra también mientras el panel lanza la detección. */}
      <div className="scan count-photo__scan" aria-hidden="true" />
    </figure>
  );
}

function filePath(url: string): string {
  return url.split('?', 1)[0] ?? url;
}
