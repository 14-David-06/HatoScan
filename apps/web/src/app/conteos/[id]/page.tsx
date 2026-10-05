import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CountNotFoundError } from '@/application/errors';
import { getContainer } from '@/composition/container';
import { InvalidValueError, toCountId } from '@/domain/index';
import { CountScreen } from '@/presentation/screens/count-screen';
import { toCountDetail } from '@/presentation/view-models';

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id} · HatoScan` };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const detail = await loadDetail(id);
  return <CountScreen count={toCountDetail(detail)} />;
}

async function loadDetail(id: string) {
  try {
    return await getContainer().getCountDetail.execute(toCountId(id));
  } catch (error) {
    if (error instanceof CountNotFoundError || error instanceof InvalidValueError) notFound();
    throw error;
  }
}
