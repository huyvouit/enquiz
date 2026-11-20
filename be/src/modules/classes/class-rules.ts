import { randomInt } from 'node:crypto';

/** No 0/O, 1/I/L: the code is read aloud and copied from a projector. */
export const CLASS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CLASS_CODE_LENGTH = 6;

export function generateClassCode(): string {
  let code = '';
  for (let i = 0; i < CLASS_CODE_LENGTH; i++) {
    code += CLASS_CODE_ALPHABET[randomInt(CLASS_CODE_ALPHABET.length)];
  }
  return code;
}

/** Codes are typed by children: ignore case, spaces and dashes. */
export function normalizeClassCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

/** "Nguyễn Văn Đức" -> "nguyen van duc" (lowercase ASCII letters/spaces). */
export function stripVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Username stem for a bulk-created student: the given names without the
 * family name, e.g. "Nguyễn Minh Anh" -> "minhanh", "Phạm An" -> "phaman". At least 3 characters,
 * at most 20, so a numeric suffix still fits the 30-character limit.
 */
export function usernameStem(fullName: string): string {
  const words = stripVietnamese(fullName).split(' ').filter(Boolean);
  const given = words.length > 1 ? words.slice(1) : words;
  let stem = given.join('').slice(0, 20);
  // Short given names ("An"): use the whole name, e.g. "phaman".
  if (stem.length < 3) stem = words.join('').slice(0, 20);
  if (stem.length === 0) return 'hocsinh';
  return stem.length >= 3 ? stem : `${stem}hs`;
}

/** First free username: stem, stem2, stem3, ... */
export function pickUsername(stem: string, taken: Set<string>): string {
  if (!taken.has(stem)) return stem;
  for (let n = 2; ; n++) {
    const candidate = `${stem}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
