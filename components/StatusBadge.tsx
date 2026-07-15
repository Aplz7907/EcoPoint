import { STATUS_LABELS } from '@/lib/copy';
import type { SubmissionStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const { th, className } = STATUS_LABELS[status];
  return <span className={`badge ${className}`}>{th}</span>;
}
