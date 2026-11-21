/**
 * Guest nicknames (plan 5, L11). Pure functions, unit-tested.
 *
 * The filter is a first line of defence for a primary-school audience, not
 * a complete one: the host can still kick (and so ban) any player.
 * Short Vietnamese swear words collide with real names once accents are
 * removed ("lồn" / "Long", "cặc" / "Các"), so they are matched only with
 * their accents; unambiguous words and joined forms also match without.
 */

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 16;

/** Matched as whole words, accents included (lower case, NFC). */
const ACCENTED_WORDS = [
  'lồn',
  'cặc',
  'buồi',
  'đụ',
  'địt',
  'đéo',
  'đĩ',
  'điếm',
  'nứng',
  'chịch',
];

/** Matched as whole words after removing accents and leetspeak. */
const PLAIN_WORDS = [
  'dit',
  'buoi',
  'deo',
  'dmm',
  'dcm',
  'dkm',
  'vcl',
  'vkl',
  'vl',
  'clm',
  'cmm',
  'dm',
  'cc',
  'sex',
  'fuck',
  'fck',
  'shit',
  'bitch',
  'dick',
  'pussy',
  'porn',
  'nigga',
  'nigger',
];

/** Matched anywhere in the squeezed text (no spaces, no repeated letters). */
const JOINED = [
  'ditme',
  'ditmen',
  'dume',
  'duma',
  'dumam',
  'cailon',
  'concac',
  'dalon',
  'oclon',
  'occho',
  'fuck',
  'shit',
  'bitch',
  'porn',
  'nigger',
];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
};

const stripAccents = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

/** Lower case, accents off, leetspeak decoded, letters repeated once. */
export function plainForm(text: string): string {
  return stripAccents(text.toLowerCase())
    .replace(/[013457@$8]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z\s]/g, ' ')
    .replace(/(.)\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isRude(nickname: string): boolean {
  const accented = nickname
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}]+/u);
  if (accented.some((w) => ACCENTED_WORDS.includes(w))) return true;
  const plain = plainForm(nickname);
  if (plain.split(' ').some((w) => PLAIN_WORDS.includes(w))) return true;
  const squeezed = plain.replace(/ /g, '');
  return JOINED.some((w) => squeezed.includes(w));
}

export type NicknameCheck =
  | { ok: true; nickname: string }
  | { ok: false; reason: 'length' | 'characters' | 'rude' };

/** 2–16 letters (Vietnamese accents allowed), digits and single spaces. */
export function checkNickname(raw: unknown): NicknameCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'length' };
  const nickname = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return { ok: false, reason: 'length' };
  }
  if (!/^[\p{L}\p{M}\p{N} ]+$/u.test(nickname)) {
    return { ok: false, reason: 'characters' };
  }
  if (isRude(nickname)) return { ok: false, reason: 'rude' };
  return { ok: true, nickname };
}

/** "Mèo" → "Mèo 2", "Mèo 3"… when the name is taken (case-insensitive). */
export function uniqueNickname(wanted: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.toLocaleLowerCase('vi')));
  if (!used.has(wanted.toLocaleLowerCase('vi'))) return wanted;
  for (let n = 2; n < 100; n++) {
    const suffix = ` ${n}`;
    const candidate =
      wanted.slice(0, NICKNAME_MAX - suffix.length).trimEnd() + suffix;
    if (!used.has(candidate.toLocaleLowerCase('vi'))) return candidate;
  }
  return wanted;
}
