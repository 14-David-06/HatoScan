export interface TransferProgress {
  readonly loaded: number;
  readonly total: number;
}

export interface JsonReply {
  readonly ok: boolean;
  readonly status: number;
  readonly body: unknown;
}

/** Destino de subida que entrega `POST /api/counts/uploads`. */
export interface UploadTarget {
  readonly uploadKey: string;
  readonly url: string;
  readonly method: 'PUT';
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * Sube el archivo directo al almacenamiento con progreso real. `fetch` no informa los bytes
 * enviados, y una foto de 10–30 MB tarda lo suficiente como para que la persona necesite verlo.
 */
export function uploadWithProgress(
  target: UploadTarget,
  file: Blob,
  onProgress: (progress: TransferProgress) => void,
): Promise<JsonReply> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    // Van firmadas: S3 rechaza la subida si cambian.
    for (const [name, value] of Object.entries(target.headers)) xhr.setRequestHeader(name, value);
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
          'Se perdió la conexión con el almacenamiento durante la subida. Revisa la red y vuelve a intentarlo.',
        ),
      );
    xhr.onabort = () => reject(new Error('La subida se canceló antes de terminar.'));
    xhr.send(file);
  });
}

export async function postJson(url: string, body: unknown): Promise<JsonReply> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, status: response.status, body: parseJson(await response.text()) };
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

/** Lee el destino de subida de la respuesta del servidor; `undefined` si no tiene la forma. */
export function readUploadTarget(body: unknown): UploadTarget | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { uploadKey, url, method, headers } = body as Record<string, unknown>;
  if (typeof uploadKey !== 'string' || typeof url !== 'string' || method !== 'PUT') {
    return undefined;
  }
  if (typeof headers !== 'object' || headers === null) return undefined;
  const entries = Object.entries(headers);
  if (!entries.every(([, value]) => typeof value === 'string')) return undefined;
  return { uploadKey, url, method, headers: Object.fromEntries(entries) as Record<string, string> };
}
