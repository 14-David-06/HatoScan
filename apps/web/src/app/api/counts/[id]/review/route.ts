import { getContainer } from '@/composition/container';
import { reviewCountHandler } from '@/presentation/http/count-handlers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return reviewCountHandler(getContainer().reviewCount)(request, id);
}
