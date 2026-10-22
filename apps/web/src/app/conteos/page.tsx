import type { Metadata } from 'next';
import { getContainer } from '@/composition/container';
import { canReview } from '@/domain/index';
import { CountsScreen } from '@/presentation/screens/counts-screen';
import { toCountSummary } from '@/presentation/view-models';
import { requireUser } from '../_auth/session';

export const metadata: Metadata = { title: 'Conteos · HatoScan' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUser('/conteos');
  const counts = await getContainer().listCounts.execute();
  return <CountsScreen counts={counts.map(toCountSummary)} canUpload={canReview(user)} />;
}
