import type { CountStatus } from '@/domain/index';
import { STATUS_LABELS } from '../view-models';

/** Estado del conteo con el color que usa en toda la app (ver styles/tokens.css). */
export function StatusBadge({ status, size = 'md' }: { status: CountStatus; size?: 'md' | 'lg' }) {
  return (
    <span className={`status status--${status}${size === 'lg' ? ' status--lg' : ''}`}>
      <span className="status__dot" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
