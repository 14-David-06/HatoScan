import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CountNotFoundError } from '@/application/errors';
import { getContainer } from '@/composition/container';
import { InvalidValueError, toCountId } from '@/domain/index';
import { CountScreen } from '@/presentation/screens/count-screen';
import { toCountDetail, toSessionUser } from '@/presentation/view-models';
import { requireUser } from '../../_auth/session';

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
  const user = await requireUser(`/conteos/${id}`);
  const detail = await loadDetail(id);
  // Revisado y procesando no muestran el selector de métodos; procesando se refresca cada pocos
  // segundos y no debe consultar al detector mientras trabaja.
  const { status } = detail.count;
  const catalog =
    status === 'revisado' || status === 'procesando'
      ? null
      : await getContainer()
          .listDetectionMethods.execute()
          .catch(() => null);
  return (
    <CountScreen count={toCountDetail(detail)} catalog={catalog} viewer={toSessionUser(user)} />
  );
}

async function loadDetail(id: string) {
  try {
    return await getContainer().getCountDetail.execute(toCountId(id));
  } catch (error) {
    if (error instanceof CountNotFoundError || error instanceof InvalidValueError) notFound();
    throw error;
  }
}
