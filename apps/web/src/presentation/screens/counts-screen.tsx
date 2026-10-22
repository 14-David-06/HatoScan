import { CountsEmpty } from '../counts/counts-empty';
import { CountsHeader } from '../counts/counts-header';
import { CountsInventory } from '../counts/counts-inventory';
import type { CountSummaryView } from '../view-models';

export function CountsScreen({
  counts,
  canUpload,
}: {
  counts: readonly CountSummaryView[];
  canUpload: boolean;
}) {
  return (
    <main className="page">
      <CountsHeader />
      {counts.length === 0 ? (
        <CountsEmpty canUpload={canUpload} />
      ) : (
        <CountsInventory counts={counts} />
      )}
    </main>
  );
}
