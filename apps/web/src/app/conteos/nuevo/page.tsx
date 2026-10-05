import type { Metadata } from 'next';
import { NewCountScreen } from '@/presentation/screens/new-count-screen';

export const metadata: Metadata = { title: 'Nuevo conteo · HatoScan' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return <NewCountScreen today={new Date().toISOString().slice(0, 10)} />;
}
