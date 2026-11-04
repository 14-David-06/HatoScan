import { getContainer } from '@/composition/container';
import { authorizeReviewer } from '../../../_auth/session';
import { createUploadHandler } from '@/presentation/http/count-handlers';

export async function POST(request: Request): Promise<Response> {
  const user = await authorizeReviewer();
  if (user instanceof Response) return user;
  return createUploadHandler(getContainer().createImageUpload)(request);
}
