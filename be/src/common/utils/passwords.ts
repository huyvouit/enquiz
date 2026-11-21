import bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'node:crypto';

export const BCRYPT_ROUNDS = 10;

/**
 * Passwords never travel in clear text (plan D22, owner's request): the
 * browser sends SHA-256("enquiz-pw-v1:" + username + ":" + password) as hex,
 * and the server stores bcrypt of that. The username salts the hash, so two
 * accounts with the same password send different values. The same function
 * lives in fe/src/shared/lib/password-hash.ts; keep them identical.
 *
 * This hides the original password from anyone who can read the decrypted
 * traffic (a school TLS proxy, a log). The hash itself still logs in, so it
 * is as secret as a password.
 */
export function clientPasswordHash(username: string, password: string): string {
  return (
    createHash('sha256')
      // NFC: Vietnamese keyboards on macOS and Windows compose accents differently.
      .update(
        `enquiz-pw-v1:${username.trim().toLowerCase()}:${password}`.normalize(
          'NFC',
        ),
      )
      .digest('hex')
  );
}

/** What a client hash looks like; anything else is an outdated app. */
export const CLIENT_HASH = /^[0-9a-f]{64}$/;
export const OUTDATED_APP =
  'Ứng dụng đã cũ, vui lòng tải lại trang (F5) rồi thử lại';

/** The stored form of a password the client hashed. */
export const hashForStorage = (clientHash: string): Promise<string> =>
  bcrypt.hash(clientHash, BCRYPT_ROUNDS);

/** The stored form of a password made on the server (temporary, seed, CLI). */
export const hashPlainForStorage = (
  username: string,
  password: string,
): Promise<string> => hashForStorage(clientPasswordHash(username, password));

export const passwordMatches = (
  clientHash: string,
  stored: string,
): Promise<boolean> => bcrypt.compare(clientHash, stored);

/** Easy English words: a password a 6-year-old can type is also a tiny lesson. */
const WORDS = [
  'apple',
  'bear',
  'bird',
  'blue',
  'cake',
  'cat',
  'duck',
  'fish',
  'frog',
  'green',
  'happy',
  'horse',
  'kite',
  'lion',
  'milk',
  'moon',
  'panda',
  'pink',
  'rain',
  'red',
  'robot',
  'star',
  'sun',
  'tiger',
  'tree',
  'zebra',
];

/** e.g. "tiger42". Only ever returned once to the person who created it. */
export function kidPassword(): string {
  return `${WORDS[randomInt(WORDS.length)]}${randomInt(10, 100)}`;
}
