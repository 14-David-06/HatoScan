'use client';

import { useId, useState } from 'react';
import { AlertTriangleIcon, InfoIcon } from '../ui/icons';
import type { DetectionMethodsView } from '../view-models';

interface MethodSelectProps {
  /** Nombre del grupo de radios. Por defecto uno único por instancia. */
  readonly name?: string;
  readonly catalog: DetectionMethodsView;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}

/**
 * Selector del método de detección: una línea por método y, debajo de la lista, la descripción
 * del elegido (así las opciones no se mueven al cambiar y caben en una columna estrecha). Los
 * métodos no disponibles se ven pero no se pueden elegir. Si no se pudo leer la lista, explica que
 * se usará el predeterminado (valor vacío).
 */
export function MethodSelect({ name, catalog, value, onChange, disabled }: MethodSelectProps) {
  const ownName = useId();
  const groupName = name ?? ownName;

  if (!catalog) {
    return (
      <div className="method-select">
        <p className="method-select__legend">Método de detección</p>
        <div className="callout">
          <InfoIcon size={16} />
          <p>No se pudo consultar la lista de métodos. Se usará el método predeterminado.</p>
        </div>
      </div>
    );
  }

  const selected = catalog.methods.find((m) => m.name === value);
  const noneAvailable = !catalog.methods.some((m) => m.available);
  const noteId = `${groupName}-note`;

  return (
    <fieldset className="method-select" disabled={disabled}>
      <legend className="method-select__legend">Método de detección</legend>
      <div className="method-select__options">
        {catalog.methods.map((m) => {
          const descriptionId = `${groupName}-${m.name}`;
          return (
            <label
              key={m.name}
              className="method-option"
              data-unavailable={m.available ? undefined : true}
            >
              <input
                type="radio"
                className="method-option__input"
                name={groupName}
                value={m.name}
                checked={value === m.name}
                onChange={() => onChange(m.name)}
                disabled={!m.available}
                aria-describedby={
                  !m.available ? descriptionId : value === m.name ? noteId : undefined
                }
              />
              <span className="method-option__radio" aria-hidden="true" />
              <span className="method-option__main">
                <span className="method-option__label">
                  {m.label}
                  {m.name === catalog.defaultMethod && (
                    <span className="method-option__badge">Predeterminado</span>
                  )}
                </span>
                {!m.available && (
                  <span className="method-option__desc" id={descriptionId}>
                    No disponible: falta configurar la llave de su proveedor de IA.
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {selected && (
        <p className="method-select__note" id={noteId}>
          {selected.description}{' '}
          <span className="tag">
            {selected.name}@{selected.version}
          </span>
        </p>
      )}
      {noneAvailable && (
        <div className="callout callout--danger" role="alert">
          <AlertTriangleIcon size={16} />
          <p>Ningún método está disponible: faltan las llaves de IA en el servidor.</p>
        </div>
      )}
    </fieldset>
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

/** Nombre legible del método elegido, para los mensajes de progreso; `null` si es el predeterminado. */
export function methodLabel(catalog: DetectionMethodsView, value: string): string | null {
  return catalog?.methods.find((m) => m.name === value)?.label ?? null;
}
