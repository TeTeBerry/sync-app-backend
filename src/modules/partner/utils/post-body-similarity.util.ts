/**
 * Normalize recruiting post body for duplicate / near-duplicate checks.
 * Ignores whitespace, common punctuation, and #hashtag markers.
 */
export function normalizePostBodyForComparison(body: string): string {
  return body
    .trim()
    .toLowerCase()
    .replace(/[#＃]/g, '')
    .replace(/\s+/g, '')
    .replace(
      /[，,、。．.!！?？~～\-—_·•：:；;「」『』【】()（）[\]{}'"“”‘’]/g,
      '',
    );
}

const MIN_SUBSTRING_SIMILARITY_LEN = 10;

/**
 * Whether two post bodies are the same or clearly near-duplicates (spam repost).
 */
export function arePostBodiesSimilar(a: string, b: string): boolean {
  const left = normalizePostBodyForComparison(a);
  const right = normalizePostBodyForComparison(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length < MIN_SUBSTRING_SIMILARITY_LEN) return false;
  if (!longer.includes(shorter)) return false;

  return shorter.length / longer.length >= 0.72;
}
