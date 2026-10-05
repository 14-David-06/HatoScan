import { getContainer } from '@/composition/container';
import { CountsScreen } from '@/presentation/screens/counts-screen';
import { toCountSummary } from '@/presentation/view-models';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const counts = await getContainer().listCounts.execute();
  return <CountsScreen counts={counts.map(toCountSummary)} />;
}
