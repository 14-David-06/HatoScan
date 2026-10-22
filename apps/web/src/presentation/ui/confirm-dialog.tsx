'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ConfirmOptions {
  readonly title: string;
  readonly body?: ReactNode;
  /** Texto del botón que confirma: el verbo de la acción, ej. «Confirmar conteo». */
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  /** `danger` cuando la acción descarta trabajo. */
  readonly tone?: 'primary' | 'danger';
}

interface Pending extends ConfirmOptions {
  readonly resolve: (confirmed: boolean) => void;
}

/**
 * Confirmación con un `<dialog>` nativo (foco atrapado, Esc cierra) en lugar de `window.confirm`.
 * Uso: `const [confirm, dialog] = useConfirm();` y luego `if (!(await confirm({...}))) return;`,
 * renderizando `{dialog}` en el componente.
 */
export function useConfirm(): readonly [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const settle = useCallback(
    (confirmed: boolean) => {
      pending?.resolve(confirmed);
      setPending(null);
    },
    [pending],
  );

  const dialog = pending ? <ConfirmDialog options={pending} onSettle={settle} /> : null;
  return [confirm, dialog] as const;
}

function ConfirmDialog({
  options,
  onSettle,
}: {
  options: ConfirmOptions;
  onSettle: (confirmed: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="confirm-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onSettle(false);
      }}
      onClick={(event) => {
        // Clic en el fondo (fuera de la caja del diálogo): cancela.
        if (event.target === event.currentTarget) onSettle(false);
      }}
    >
      <div className="dialog__body">
        <h2 id="confirm-dialog-title" className="dialog__title">
          {options.title}
        </h2>
        {options.body && <div className="dialog__text">{options.body}</div>}
      </div>
      <div className="dialog__actions">
        <button type="button" className="button" onClick={() => onSettle(false)}>
          {options.cancelLabel ?? 'Cancelar'}
        </button>
        <button
          type="button"
          className={`button ${options.tone === 'danger' ? 'button--danger' : 'button--primary'}`}
          onClick={() => onSettle(true)}
          autoFocus
        >
          {options.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
