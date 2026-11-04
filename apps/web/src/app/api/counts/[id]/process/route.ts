import { getContainer } from '@/composition/container';
import { authorizeReviewer } from '../../../../_auth/session';
import { processCountHandler } from '@/presentation/http/count-handlers';

// La detección sobre una foto completa puede tardar minutos (claude-vision, 20 MP: 2–4 min). 800 s
// es el máximo de Vercel Pro con fluid compute; el detector tiene el mismo límite (ADR 0006).
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
