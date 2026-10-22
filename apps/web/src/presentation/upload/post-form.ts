export interface TransferProgress {
  readonly loaded: number;
  readonly total: number;
}

export interface JsonReply {
  readonly ok: boolean;
  readonly status: number;
  readonly body: unknown;
}

/**
 * `POST` multipart con progreso real de subida. `fetch` no informa los bytes enviados, y una foto
 * de 10–30 MB tarda lo suficiente como para que la persona necesite verlo.
 */
export function postFormWithProgress(
  url: string,
  form: FormData,
  onProgress: (progress: TransferProgress) => void,
): Promise<JsonReply> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress({ loaded: event.loaded, total: event.total });
    };
    xhr.onload = () =>
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        body: parseJson(xhr.responseText),
      });
    xhr.onerror = () =>
      reject(
        new Error(
          'Se perdió la conexión con el servidor durante la subida. Revisa la red y vuelve a intentarlo.',
        ),
      );
    xhr.onabort = () => reject(new Error('La subida se canceló antes de terminar.'));
    xhr.send(form);
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

/** Lee `{ id }` o `{ error }` de la respuesta del servidor sin confiar en su forma. */
export function readReply(body: unknown): { readonly id?: string; readonly error?: string } {
  if (typeof body !== 'object' || body === null) return {};
  const { id, error } = body as Record<string, unknown>;
  return {
    ...(typeof id === 'string' && id !== '' && { id }),
    ...(typeof error === 'string' && error !== '' && { error }),
  };
}
