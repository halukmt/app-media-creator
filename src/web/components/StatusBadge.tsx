import { en } from '../i18n/en';
import type { CheckStatus } from '../lib/export';

interface Props {
  status: CheckStatus;
}

const STATUS_CLASS: Record<CheckStatus, string> = {
  ok: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
};

/** Validation state with a visible word, so the meaning never depends on colour alone (L4). */
export function StatusBadge({ status }: Props) {
  return <span className={`badge badge-sm shrink-0 ${STATUS_CLASS[status]}`}>{en.status[status]}</span>;
}
