import { getContainer } from '@/composition/container';

type Params = { params: Promise<{ key: string[] }> };

/**
 * Sirve y recibe objetos del almacenamiento local con URL firmada y caducable (solo desarrollo,
 * ADR 0004). Hace el papel de S3: el navegador sube la foto con PUT y el navegador y el detector la
 * leen con GET. En producción (S3) responde 404.
 */
export async function GET(request: Request, { params }: Params): Promise<Response> {
  const files = getContainer().localFiles;
  if (!files) return notFound();
  const { key } = await params;
  const url = new URL(request.url);
  const object = await files.readSigned({
    key: key.join('/'),
    expires: url.searchParams.get('expires'),
    signature: url.searchParams.get('signature'),
  });
  if (!object) return notFound();

  return new Response(new Blob([new Uint8Array(object.body)]), {
    headers: {
      'content-type': object.contentType,
      'content-length': String(object.body.byteLength),
      'cache-control': 'private, max-age=300',
    },
  });
}

export async function PUT(request: Request, { params }: Params): Promise<Response> {
  const files = getContainer().localFiles;
  if (!files) return notFound();
  const { key } = await params;
  const url = new URL(request.url);
  try {
    const stored = await files.writeSigned({
      key: key.join('/'),
      expires: url.searchParams.get('expires'),
      signature: url.searchParams.get('signature'),
      contentType: request.headers.get('content-type') ?? '',
      body: new Uint8Array(await request.arrayBuffer()),
    });
    return stored ? new Response(null, { status: 200 }) : forbidden();
  } catch {
    return forbidden();
  }
}

const notFound = () => new Response('Not found', { status: 404 });
const forbidden = () => new Response('Forbidden', { status: 403 });
