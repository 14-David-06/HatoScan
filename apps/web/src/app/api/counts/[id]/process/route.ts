import { getContainer } from '@/composition/container';
import { authorizeReviewer } from '../../../../_auth/session';
import { processCountHandler } from '@/presentation/http/count-handlers';

// La detección sobre una foto completa puede tardar; el detector tiene su propio timeout.
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await authorizeReviewer();
  if (user instanceof Response) return user;
  const { id } = await params;
  return processCountHandler(getContainer().processCount)(request, id);
}
