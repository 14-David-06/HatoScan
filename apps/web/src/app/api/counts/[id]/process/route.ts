import { getContainer } from '@/composition/container';
import { authorizeReviewer } from '../../../../_auth/session';
import { processCountHandler } from '@/presentation/http/count-handlers';

// La detección sobre una foto completa puede tardar minutos (claude-vision, 20 MP: 2–4 min). 800 s
// es el máximo de Vercel Pro con fluid compute; el detector se rinde antes, a los
// DETECTOR_TIMEOUT_MS, para dejar el conteo en `error` (ADR 0006, ADR 0007).
export const maxDuration = 800;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await authorizeReviewer();
  if (user instanceof Response) return user;
  const { id } = await params;
  return processCountHandler(getContainer().processCount)(request, id);
}
