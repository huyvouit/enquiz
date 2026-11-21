import { clientPasswordHash } from '../src/common/utils/passwords.js';

/** What the browser sends instead of the password (see passwords.ts). */
export const pw = clientPasswordHash;

/** The username inside an access token, to hash passwords for its owner. */
export const usernameOf = (token: string): string =>
  (
    JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
      username: string;
    }
  ).username;
