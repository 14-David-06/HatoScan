import { getContainer } from '@/composition/container';
import { processCountHandler } from '@/presentation/http/count-handlers';

// La detección sobre una foto completa puede tardar; el detector tiene su propio timeout.
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return processCountHandler(getContainer().processCount)(id);
}
