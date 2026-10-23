import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getContainer } from '@/composition/container';
import { canReview } from '@/domain/index';
import { NewCountScreen } from '@/presentation/screens/new-count-screen';
import { requireUser } from '../../_auth/session';

export const metadata: Metadata = { title: 'Nuevo conteo · HatoScan' };
export const dynamic = 'force-dynamic';

// Fecha de hoy en la finca (no en UTC): pasadas las 19:00 en Bogotá, UTC ya es mañana.
const farmToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });

export default async function Page() {
  if (!canReview(await requireUser('/conteos/nuevo'))) redirect('/conteos');
  const container = getContainer();
  const [catalog, farms] = await Promise.all([
    // Si el servicio de detección no responde, la carga sigue siendo posible.
    container.listDetectionMethods.execute().catch(() => null),
    container.listFarms.execute(),
  ]);
  return <NewCountScreen today={farmToday.format(new Date())} catalog={catalog} farms={farms} />;
}
