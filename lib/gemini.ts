import 'server-only';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { WASTE_CODES, type AiVisionResult, type DetectedItem, type WasteCode } from './types';

/**
 * The model. Overridable via GEMINI_MODEL without a code change.
 *
 * Not gemini-2.0-flash: new API-key projects get `limit: 0` free-tier quota on
 * the 2.x models, so every call 429s. Of the models a fresh key can actually
 * reach, this one answers the waste prompt in ~1.5s; gemini-flash-latest takes
 * ~12s and gemini-3.5-flash "thinks" for over 90s, neither of which is
 * acceptable for someone standing outside holding a phone.
 */
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

/** One retry, because 503 "high demand" from Gemini is common and transient. */
const RETRY_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SYSTEM_INSTRUCTION = `คุณคือระบบตรวจสอบขยะรีไซเคิลสำหรับแอปเก็บแต้ม
วิเคราะห์รูปภาพและตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความหรือ markdown อื่นใด

{
  "items": [
    { "type": "plastic_bottle", "count": 3, "confidence": 0.95 }
  ],
  "is_recyclable_photo": true,
  "is_screen_photo": false,
  "notes": "คำอธิบายสั้นๆ ภาษาไทย"
}

กติกา:
- type ต้องเป็นหนึ่งใน: plastic_bottle, can, glass_bottle, paper_carton
- ถ้าไม่พบขยะรีไซเคิลเลย ให้ items เป็น [] และ is_recyclable_photo = false
- is_screen_photo = true ถ้ารูปนี้เป็นการถ่ายภาพจากหน้าจอมือถือ/คอมพิวเตอร์/รูปพิมพ์ (ตรวจหา moiré, ขอบจอ, แสงสะท้อน, pixel grid)
- นับเฉพาะชิ้นที่มองเห็นชัดเจน อย่าเดา
- confidence คือความมั่นใจ 0.0–1.0`;

export type GeminiOutcome =
  /** Gemini answered and the answer made sense. */
  | { ok: true; result: AiVisionResult; raw: unknown }
  /**
   * Gemini answered with something we could not trust (bad JSON, wrong shape),
   * or the API itself failed. Callers must never award points and never crash;
   * /api/submit turns this into a 503 and records nothing, so the user can just
   * send the same photo again.
   */
  | { ok: false; reason: 'parse_failed' | 'api_failed'; raw: unknown };

/**
 * Strips markdown fences and any chatter around the JSON object.
 *
 * Gemini in JSON mode usually returns bare JSON, but this is the one place the
 * whole system trusts an outside party, so it is treated as hostile input.
 */
export function extractJson(text: string): string {
  let t = text.trim();

  // ```json … ```  or  ``` … ```
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) t = fenced[1].trim();

  // Fall back to the outermost { … } if the model wrapped it in prose.
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last > first) t = t.slice(first, last + 1);

  return t.trim();
}

/**
 * Coerces whatever came back into AiVisionResult, or returns null if it is too
 * malformed to trust. Anything unexpected is dropped, not guessed at.
 */
export function parseVisionResponse(text: string): AiVisionResult | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  // A response with no boolean verdicts is not something we can act on.
  if (
    typeof obj.is_recyclable_photo !== 'boolean' ||
    typeof obj.is_screen_photo !== 'boolean'
  ) {
    return null;
  }

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items: DetectedItem[] = [];

  for (const entry of rawItems) {
    if (typeof entry !== 'object' || entry === null) continue;

    const e = entry as Record<string, unknown>;
    const type = e.type;

    // Unknown waste codes are silently dropped: an item we cannot price is an
    // item we cannot pay for.
    if (typeof type !== 'string' || !WASTE_CODES.includes(type as WasteCode)) {
      continue;
    }

    const count = Math.floor(Number(e.count));
    if (!Number.isFinite(count) || count <= 0) continue;

    const rawConfidence = Number(e.confidence);
    const confidence = Number.isFinite(rawConfidence)
      ? Math.min(1, Math.max(0, rawConfidence))
      : 0; // No confidence reported → treat as zero, so the item earns nothing.

    items.push({ type: type as WasteCode, count, confidence });
  }

  return {
    items,
    is_recyclable_photo: obj.is_recyclable_photo,
    is_screen_photo: obj.is_screen_photo,
    notes: typeof obj.notes === 'string' ? obj.notes.slice(0, 500) : '',
  };
}

/**
 * The only call in the app that costs Gemini quota. Everything cheap must
 * already have passed before this runs.
 */
export async function analyzeWasteImage(
  image: Buffer,
  mimeType: string
): Promise<GeminiOutcome> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { ok: false, reason: 'api_failed', raw: { error: 'GEMINI_API_KEY is not set' } };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      // JSON mode: the SDK supports it, so use it — it removes most of the
      // ways the reply could come back as prose.
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const parts = [
    { inlineData: { data: image.toString('base64'), mimeType } },
    { text: 'วิเคราะห์รูปนี้ตามกติกา แล้วตอบเป็น JSON' },
  ];

  let text: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await model.generateContent(parts);
      text = response.response.text();
      break;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);

      // Only "high demand" is worth retrying. A 429 means the quota is gone and
      // hammering it again would just burn another request.
      const transient = message.includes('503') || message.includes('overloaded');
      if (!transient || attempt === 1) break;

      await sleep(RETRY_DELAY_MS);
    }
  }

  if (text === null) {
    return {
      ok: false,
      reason: 'api_failed',
      raw: {
        error: lastError instanceof Error ? lastError.message : String(lastError),
      },
    };
  }

  const result = parseVisionResponse(text);

  if (!result) {
    return { ok: false, reason: 'parse_failed', raw: { text } };
  }

  return { ok: true, result, raw: { text, parsed: result } };
}
