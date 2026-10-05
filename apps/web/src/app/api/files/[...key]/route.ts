import { getContainer } from '@/composition/container';

/**
 * Sirve objetos del almacenamiento local con URL firmada y caducable (solo desarrollo, ADR 0004).
 * Lo usan el navegador (pantalla de revisión) y el detector para descargar la imagen original.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key } = await params;
  const url = new URL(request.url);
  const object = await getContainer().localFiles.readSigned({
    key: key.join('/'),
    expires: url.searchParams.get('expires'),
    signature: url.searchParams.get('signature'),
  });
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(new Blob([new Uint8Array(object.body)]), {
    headers: {
      'content-type': object.contentType,
      'content-length': String(object.body.byteLength),
      'cache-control': 'private, max-age=300',
    },
  });
}
