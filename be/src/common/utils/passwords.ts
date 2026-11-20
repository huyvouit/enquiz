import { randomInt } from 'node:crypto';

export const BCRYPT_ROUNDS = 10;

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
