import type { Metadata } from 'next';
import { getContainer } from '@/composition/container';
import { NewCountScreen } from '@/presentation/screens/new-count-screen';

export const metadata: Metadata = { title: 'Nuevo conteo · HatoScan' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  // Si el servicio de detección no responde, la carga sigue siendo posible.
  const catalog = await getContainer()
    .listDetectionMethods.execute()
    .catch(() => null);
  return <NewCountScreen today={new Date().toISOString().slice(0, 10)} catalog={catalog} />;
}
