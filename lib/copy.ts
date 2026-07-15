import type { SubmissionStatus, WasteCode } from './types';

/** Thai label + emoji per waste code. name_th in the DB is authoritative for
 *  points; this is only for icons and fallback labels in the UI. */
export const WASTE_LABELS: Record<WasteCode, { th: string; emoji: string }> = {
  plastic_bottle: { th: 'ขวดพลาสติก', emoji: '🧴' },
  can: { th: 'กระป๋อง', emoji: '🥫' },
  glass_bottle: { th: 'ขวดแก้ว', emoji: '🍾' },
  paper_carton: { th: 'กล่องกระดาษ', emoji: '📦' },
};

/**
 * One primary per state, no tints. A status here is a colour block you read
 * from across the room, not a pastel chip you have to squint at.
 */
export const STATUS_LABELS: Record<
  SubmissionStatus,
  { th: string; className: string }
> = {
  approved: {
    th: 'ผ่าน',
    className: 'bg-bau-green text-white',
  },
  pending_review: {
    th: 'รอตรวจ',
    className: 'bg-bau-yellow text-bau-ink',
  },
  rejected: {
    th: 'ไม่ผ่าน',
    className: 'bg-bau-red text-white',
  },
};

/** "3 นาทีที่แล้ว" — no date library needed. */
export function timeAgoTh(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);

  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วันที่แล้ว`;

  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatPoints(n: number): string {
  return n.toLocaleString('th-TH');
}
