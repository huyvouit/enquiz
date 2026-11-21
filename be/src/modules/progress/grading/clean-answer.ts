/**
 * Answer shapes a student may send (launch A5): one text, a list of texts
 * (ordering) or a list of {left, right} pairs (matching), all bounded.
 * Shared by practice sessions and exams (plan 4.2).
 */
/** Longest text kept for one typed answer or one piece. */
const MAX_TEXT = 300;
/** Most pieces / pairs kept for one answer. */
const MAX_ITEMS = 30;

const isText = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= MAX_TEXT;

const isPair = (v: unknown): boolean =>
  typeof v === 'object' &&
  v !== null &&
  isText((v as { left?: unknown }).left) &&
  isText((v as { right?: unknown }).right);

/**
 * A storable answer, or null (not answered / unexpected shape). Pairs are
 * reduced to {left, right} so nothing else is ever stored.
 */
export function cleanAnswer(value: unknown): unknown {
  if (typeof value === 'string') {
    return isText(value) && value.trim() !== '' ? value : null;
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEMS) {
    return null;
  }
  if (value.every(isText)) return value;
  if (value.every(isPair)) {
    return (value as { left: string; right: string }[]).map((p) => ({
      left: p.left,
      right: p.right,
    }));
  }
  return null;
}
