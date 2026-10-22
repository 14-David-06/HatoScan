import { getContainer } from '@/composition/container';
import { authorizeReviewer } from '../../../../_auth/session';
import { reviewCountHandler } from '@/presentation/http/count-handlers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await authorizeReviewer();
  if (user instanceof Response) return user;
  const { id } = await params;
  return reviewCountHandler(getContainer().reviewCount)(request, id, user.id);
}
