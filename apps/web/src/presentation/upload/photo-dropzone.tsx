'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { formatBytes, formatDimensions } from '../format';
import { AlertTriangleIcon, ImageIcon, UploadIcon } from '../ui/icons';
import {
  ACCEPT_ATTRIBUTE,
  blobReader,
  isTiff,
  looksDownscaled,
  normalizeImageFile,
  readTiffSize,
  type PixelSize,
} from './photo-file';

interface Selection {
  readonly file: File;
  readonly url: string;
  readonly preview: 'loading' | 'ready' | 'unavailable';
  readonly size: PixelSize | null;
}

interface PhotoDropzoneProps {
  /** Nombre del campo en el FormData. */
  readonly name: string;
  readonly disabled: boolean;
  /** Barrido de escaneo sobre la foto: solo mientras el detector trabaja. */
  readonly scanning: boolean;
  /** Sustituye el pie del visor (datos del archivo) mientras se envía el formulario. */
  readonly readout?: ReactNode;
}

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

function assignToInput(input: HTMLInputElement, file: File | null) {
  if (!file) {
    input.value = '';
    return;
  }
  if (input.files?.[0] === file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

/**
 * Zona de la foto aérea: visor oscuro donde se suelta o elige la foto. El `<input type="file">`
 * real vive aquí dentro del formulario (oculto a la vista, no al teclado), para que el FormData lo
 * envíe tal cual: la foto nunca se recorta ni se reduce en el navegador.
 */
export function PhotoDropzone({ name, disabled, scanning, readout }: PhotoDropzoneProps) {
  const inputId = useId();
  const hintId = useId();
  const zoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoca la URL de la vista previa al cambiar de foto y al desmontar.
  const previewUrl = selection?.url;
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Soltar una foto fuera de la zona no debe abrirla en la pestaña y perder el formulario. Fuera
  // de la zona el cursor dice que ahí no se puede soltar; dentro, la zona ya pidió «copy».
  useEffect(() => {
    const block = (event: globalThis.DragEvent) => {
      const transfer = event.dataTransfer;
      if (!transfer?.types.includes('Files')) return;
      event.preventDefault();
      const target = event.target;
      if (!(target instanceof Node && zoneRef.current?.contains(target))) {
        transfer.dropEffect = 'none';
      }
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  const choose = (candidate: File | undefined) => {
    const input = inputRef.current;
    if (!input) return;
    if (!candidate) {
      // Selector cancelado: algunos navegadores vacían el campo; se conserva la foto anterior.
      assignToInput(input, selection?.file ?? null);
      return;
    }
    const file = normalizeImageFile(candidate);
    if (!file) {
      setError(
        `«${candidate.name}» no es una foto JPG, PNG ni TIFF. Exporta la foto original del dron ` +
          'en uno de esos formatos y vuelve a elegirla.',
      );
      assignToInput(input, selection?.file ?? null);
      return;
    }
    setError(null);
    assignToInput(input, file);
    const url = URL.createObjectURL(file);
    setSelection({ file, url, preview: 'loading', size: null });
    if (isTiff(file)) {
      readTiffSize(blobReader(file))
        .then((size) => {
          if (size) setSelection((s) => (s?.url === url && !s.size ? { ...s, size } : s));
        })
        .catch(() => undefined);
    }
  };

  const update = (url: string, patch: Partial<Selection>) =>
    setSelection((s) => (s?.url === url ? { ...s, ...patch } : s));

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      openPicker();
    }
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event) || disabled) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
  };

  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!disabled) choose(event.dataTransfer.files[0]);
  };

  const size = selection?.size ?? null;
  const tiff = selection ? isTiff(selection.file) : false;

  return (
    <div
      ref={zoneRef}
      className="upload-zone"
      data-state={selection ? 'selected' : 'empty'}
      data-dragging={dragging || undefined}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="upload-zone__visor">
        <div
          className="upload-zone__stage"
          style={size ? { aspectRatio: `${size.width} / ${size.height}` } : undefined}
        >
          <input
            ref={inputRef}
            id={inputId}
            className="upload-zone__input"
            type="file"
            name={name}
            accept={ACCEPT_ATTRIBUTE}
            required
            disabled={disabled}
            aria-label="Foto aérea"
            aria-describedby={selection ? undefined : hintId}
            tabIndex={selection ? -1 : undefined}
            onChange={(event: ChangeEvent<HTMLInputElement>) => choose(event.target.files?.[0])}
            onKeyDown={onInputKeyDown}
            onInvalid={() => setError('Elige la foto aérea: es la base del conteo.')}
          />

          {selection ? (
            selection.preview === 'unavailable' ? (
              <div className="upload-zone__placeholder">
                <ImageIcon size={32} />
                <p>
                  {tiff
                    ? 'Vista previa no disponible para TIFF; se sube igual.'
                    : 'No se puede mostrar la vista previa de esta foto; se sube igual.'}
                </p>
              </div>
            ) : (
              // Vista previa local (URL de objeto): next/image no aplica a un archivo sin subir.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={selection.url}
                className="upload-zone__image"
                src={selection.url}
                alt={`Vista previa de ${selection.file.name}`}
                data-loading={selection.preview === 'loading' || undefined}
                onLoad={(event) =>
                  update(selection.url, {
                    preview: 'ready',
                    size: {
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    },
                  })
                }
                onError={() => update(selection.url, { preview: 'unavailable' })}
              />
            )
          ) : (
            <label htmlFor={inputId} className="upload-zone__prompt">
              <span className="viewfinder-corners upload-zone__corners" aria-hidden="true" />
              <span className="upload-zone__badge" aria-hidden="true">
                <UploadIcon size={22} />
              </span>
              <span className="upload-zone__title">
                {dragging ? (
                  'Suelta la foto para cargarla'
                ) : (
                  <>
                    <span className="upload-zone__fine">Arrastra aquí la foto aérea</span>
                    <span className="upload-zone__coarse">Toca para elegir la foto aérea</span>
                  </>
                )}
              </span>
              <span className="upload-zone__sub upload-zone__fine">
                o haz clic para elegirla en tu equipo
              </span>
              <span className="upload-zone__sub" id={hintId}>
                JPG, PNG o TIFF, tal como sale del dron
              </span>
            </label>
          )}

          {scanning && <div className="scan" aria-hidden="true" />}

          {dragging && selection && (
            <div className="upload-zone__drop" aria-hidden="true">
              <UploadIcon size={22} />
              Suelta la foto para reemplazarla
            </div>
          )}
        </div>

        {(readout || selection) && (
          <div className="upload-zone__readout">
            {readout ??
              (selection && (
                <>
                  <dl className="facts upload-zone__facts">
                    <div className="upload-zone__fact-name">
                      <dt>Archivo</dt>
                      <dd title={selection.file.name}>{selection.file.name}</dd>
                    </div>
                    <div>
                      <dt>Tamaño</dt>
                      <dd>{formatBytes(selection.file.size)}</dd>
                    </div>
                    <div>
                      <dt>Dimensiones</dt>
                      <dd>
                        {size
                          ? formatDimensions(size.width, size.height)
                          : selection.preview === 'loading'
                            ? 'Leyendo…'
                            : 'Sin datos'}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="button upload-zone__change"
                    onClick={openPicker}
                    disabled={disabled}
                  >
                    <ImageIcon size={16} />
                    Cambiar foto
                  </button>
                </>
              ))}
          </div>
        )}
      </div>

      {error ? (
        <div className="callout callout--danger" role="alert">
          <AlertTriangleIcon size={16} />
          <p>{error}</p>
        </div>
      ) : (
        size &&
        looksDownscaled(size) && (
          <div className="callout">
            <AlertTriangleIcon size={16} />
            <p>
              La foto parece reducida ({formatDimensions(size.width, size.height)}). Si tienes el
              original del dron, súbelo: con menos resolución el detector pierde animales.
            </p>
          </div>
        )
      )}
    </div>
  );
}
