import { getContainer } from '@/composition/container';
import { authorizeReviewer } from '../../_auth/session';
import { createCountHandler } from '@/presentation/http/count-handlers';

export async function POST(request: Request): Promise<Response> {
  const user = await authorizeReviewer();
  if (user instanceof Response) return user;
  return createCountHandler(getContainer().registerCount)(request);
}
