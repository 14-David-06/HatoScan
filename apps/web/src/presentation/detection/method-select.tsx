'use client';

import { useState } from 'react';
import type { DetectionMethodsView } from '../view-models';

interface MethodSelectProps {
  readonly name?: string;
  readonly catalog: DetectionMethodsView;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}

/**
 * Selector del método de detección. Los métodos no disponibles se muestran deshabilitados.
 * Si el servicio no respondió, ofrece solo «el predeterminado del servicio» (valor vacío).
 */
export function MethodSelect({ name, catalog, value, onChange, disabled }: MethodSelectProps) {
  const selected = catalog?.methods.find((m) => m.name === value);

  return (
    <label className="field">
      <span>Método de detección</span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {catalog ? (
          catalog.methods.map((m) => (
            <option key={m.name} value={m.name} disabled={!m.available}>
              {m.label}
              {m.name === catalog.defaultMethod ? ' (predeterminado)' : ''}
              {m.available ? '' : ' — no disponible'}
            </option>
          ))
        ) : (
          <option value="">Predeterminado del servicio</option>
        )}
      </select>
      <small className="muted">
        {catalog
          ? selected && (
              <>
                {selected.description}{' '}
                <code>
                  {selected.name}@{selected.version}
                </code>
              </>
            )
          : 'No se pudo consultar la lista de métodos; se usará el predeterminado del servicio.'}
      </small>
    </label>
  );
}

/** Valor inicial del selector: el predeterminado si está disponible, o el primero disponible. */
export function initialMethod(catalog: DetectionMethodsView): string {
  if (!catalog) return '';
  const available = catalog.methods.filter((m) => m.available);
  return (available.find((m) => m.name === catalog.defaultMethod) ?? available[0])?.name ?? '';
}

export function useMethod(catalog: DetectionMethodsView) {
  return useState(() => initialMethod(catalog));
}
