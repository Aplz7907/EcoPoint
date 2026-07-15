/** The four accepted waste codes. Must stay in sync with waste_types.code. */
export const WASTE_CODES = [
  'plastic_bottle',
  'can',
  'glass_bottle',
  'paper_carton',
] as const;

export type WasteCode = (typeof WASTE_CODES)[number];

export type SubmissionStatus = 'approved' | 'pending_review' | 'rejected';

export interface Profile {
  id: string;
  display_name: string | null;
  points_balance: number;
  is_banned: boolean;
  created_at: string;
  email?: string | null;
}

export interface WasteType {
  id: number;
  code: WasteCode;
  name_th: string;
  points_per_item: number;
  is_active: boolean;
}

/** One item as reported by Gemini. */
export interface DetectedItem {
  type: WasteCode;
  count: number;
  confidence: number;
}

/** The shape we require back from Gemini, after defensive parsing. */
export interface AiVisionResult {
  items: DetectedItem[];
  is_recyclable_photo: boolean;
  is_screen_photo: boolean;
  notes: string;
}

export interface Submission {
  id: string;
  user_id: string;
  image_url: string | null;
  image_hash: string;
  image_phash: string | null;
  ai_result: Record<string, unknown> | null;
  points_earned: number;
  status: SubmissionStatus;
  reject_reason: string | null;
  created_at: string;
}

export interface Reward {
  id: number;
  name: string;
  description: string | null;
  points_cost: number;
  stock: number;
  is_active: boolean;
}

export interface Redemption {
  id: string;
  user_id: string;
  reward_id: number;
  points_spent: number;
  code: string;
  status: 'active' | 'used';
  created_at: string;
}

/** What POST /api/submit returns. The client renders this and nothing else. */
export interface SubmitResponse {
  ok: boolean;
  status?: SubmissionStatus;
  points_earned?: number;
  points_balance?: number;
  items?: Array<DetectedItem & { name_th: string; points: number }>;
  message: string;
  reject_reason?: string;
}
