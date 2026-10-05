import { getContainer } from '@/composition/container';
import { createCountHandler } from '@/presentation/http/count-handlers';

export function POST(request: Request): Promise<Response> {
  return createCountHandler(getContainer().registerCount)(request);
}
