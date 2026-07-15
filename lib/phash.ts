import 'server-only';

import sharp from 'sharp';

/**
 * Perceptual hash (dHash, 64 bits).
 *
 * SHA-256 answers "have I seen this *file* before". It cannot answer "have I
 * seen this *scene* before" — re-shooting the same bottle produces completely
 * different bytes and sails straight through. dHash answers the second
 * question: it survives re-encoding, resizing, and small changes in framing,
 * so a second photo of the same bottle on the same table lands within a few
 * bits of the first.
 *
 * How it works: shrink to 9×8 greyscale, then record whether each pixel is
 * brighter than the one to its right. That gives 8×8 = 64 bits describing the
 * *gradient structure* of the image, which is what our eyes actually key on,
 * rather than exact pixel values.
 *
 * Returned as a 64-character string of '0'/'1' so Postgres can cast it
 * straight to bit(64) and XOR two of them in one operation.
 */
export async function computeDHash(image: Buffer): Promise<string | null> {
  try {
    const pixels = await sharp(image)
      .greyscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer();

    if (pixels.length < 72) return null;

    let bits = '';

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = pixels[y * 9 + x];
        const right = pixels[y * 9 + x + 1];
        bits += left > right ? '1' : '0';
      }
    }

    return bits;
  } catch {
    // Unsupported/corrupt image (some HEIC variants, for one). The caller falls
    // back to the SHA-256 check alone — a missing perceptual hash must never
    // block a legitimate submission.
    return null;
  }
}

/** Bits that differ between two dHashes. 0 = identical scene. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;

  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) distance++;
  }

  return distance;
}
