/** "Lớp 1A" stays as is; "1A" becomes "Lớp 1A". */
export const classLabel = (name: string): string =>
  /^lớp\b/i.test(name.trim()) ? name : `Lớp ${name}`;

// Single code points on purpose (ZWJ and variation selectors are removed one
// by one), so this is an alternation, not one character class.
const EMOJI =
  /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\u{FE0F}|\u{200D}|\u{20E3}/gu;

/** Removes emoji from one string; "🐶 → dog, 🐱 → cat" becomes "dog, cat". */
export function stripEmojiText(text: string): string {
  return text
    .replace(EMOJI, '')
    .replace(/(^|, )\s*→\s*/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/**
 * Removes emoji from every string of a pdfmake document (deep copy).
 * Roboto, the PDF font, has no emoji glyphs: they would print as empty boxes.
 */
export function stripEmoji<T>(value: T): T {
  if (typeof value === 'string') return stripEmojiText(value) as T;
  if (Array.isArray(value))
    return value.map((v: unknown) => stripEmoji(v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        typeof v === 'function' ? v : stripEmoji(v),
      ]),
    ) as T;
  }
  return value;
}
