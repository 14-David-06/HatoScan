'use client';

import { useId, useRef } from 'react';
import { DetectPanel } from '../detection/detect-panel';
import { CloseIcon, RefreshIcon } from '../ui/icons';
import type { DetectionMethodsView } from '../view-models';

/**
 * «Volver a detectar» desde la revisión. Se abre en un diálogo: el panel del editor mide la ventana
 * y desplegar ahí la lista de métodos le quitaba el sitio al total. Al terminar, la pantalla monta
 * un editor nuevo con la nueva propuesta y este diálogo vuelve cerrado.
 */
export function RedetectDialog({
  countId,
  catalog,
}: {
  countId: string;
  catalog: DetectionMethodsView;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Mientras el detector trabaja no se cierra: el resultado sustituye lo que hay detrás.
  const busy = () => ref.current?.querySelector('[aria-busy="true"]') != null;
  const close = () => {
    if (!busy()) ref.current?.close();
  };

  return (
    <>
      <button
        type="button"
        className="button button--ghost button--block count-redetect"
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
      >
        <RefreshIcon size={16} />
        Volver a detectar con otro método
      </button>

      <dialog
        ref={ref}
        className="dialog count-redetect-dialog"
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (busy()) event.preventDefault();
        }}
        onClick={(event) => {
          // Clic en el fondo (fuera de la caja del diálogo): cierra.
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="count-redetect-dialog__head">
          <div className="count-redetect-dialog__intro">
            <h2 id={titleId} className="dialog__title">
              Volver a detectar
            </h2>
            <p className="dialog__text">
              El detector analiza otra vez la foto con el método que elijas. Su propuesta sustituye
              las marcas que ves ahora.
            </p>
          </div>
          <button
            type="button"
            className="button button--ghost button--icon count-redetect-dialog__close"
            aria-label="Cerrar"
            onClick={close}
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="count-redetect-dialog__body">
          <DetectPanel countId={countId} catalog={catalog} mode="again" />
        </div>
      </dialog>
    </>
  );
}
