import type { Request } from 'express';
import { parseDuration } from '../../common/utils/duration.js';
import {
  clientPasswordHash,
  CLIENT_HASH,
} from '../../common/utils/passwords.js';
import { originAllowed, readCookie } from './session-cookie.js';

const req = (cookie?: string) => ({ headers: { cookie } }) as Request;

describe('readCookie', () => {
  it('finds one cookie among others', () => {
    expect(readCookie(req('a=1; __session=abc-_1; b=2'), '__session')).toBe(
      'abc-_1',
    );
    expect(readCookie(req('__session=x%20y'), '__session')).toBe('x y');
  });

  it('is null when missing, empty or malformed', () => {
    expect(readCookie(req(), '__session')).toBeNull();
    expect(readCookie(req('my__session=abc'), '__session')).toBeNull();
    expect(readCookie(req('__session='), '__session')).toBeNull();
    expect(readCookie(req('__session=%E0%A4%A'), '__session')).toBeNull();
  });
});

describe('originAllowed', () => {
  const allowed = ['https://enquiz-x.web.app', 'http://localhost:5173'];

  it('accepts the configured origins and their preview channels', () => {
    expect(originAllowed('https://enquiz-x.web.app', allowed)).toBe(true);
    expect(originAllowed('http://localhost:5173', allowed)).toBe(true);
    expect(
      originAllowed('https://enquiz-x--v1-1-0-ab12cd.web.app', allowed),
    ).toBe(true);
  });

  it('refuses anything else', () => {
    for (const origin of [
      'https://evil.web.app',
      'https://enquiz-x.web.app.evil.com',
      'https://enquiz-x--x.web.app.evil.com',
      'https://other--enquiz-x.web.app',
      'http://enquiz-x--v1.web.app',
      'http://localhost:5174',
      'null',
    ]) {
      expect(originAllowed(origin, allowed)).toBe(false);
    }
  });
});

describe('parseDuration', () => {
  it('reads s, m, h and d', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('15m')).toBe(900_000);
    expect(parseDuration('12h')).toBe(43_200_000);
    expect(parseDuration('7d')).toBe(604_800_000);
  });

  it('is NaN for anything else', () => {
    for (const text of ['', '7', '1w', '-1d', '1.5h', 'abc']) {
      expect(parseDuration(text)).toBeNaN();
    }
  });
});

/** The browser computes the same (fe/src/shared/lib/password-hash.ts). */
describe('clientPasswordHash', () => {
  it('matches the shared test vectors', () => {
    expect(clientPasswordHash('student', 'student123')).toBe(
      'd820d3976b72f6202fa6cb4157d41f11c1ab5de2782765c29db5f5aba5f78f72',
    );
    expect(clientPasswordHash('  Co.Lan ', 'Mật khẩu 1!')).toBe(
      '0100074ca82b1a8ae623e173fbe344a79903b8a39e5ddfb9bdab170b979bd47c',
    );
    // Same password typed as decomposed accents (macOS) → same hash.
    expect(
      clientPasswordHash('  Co.Lan ', 'Mật khẩu 1!'.normalize('NFD')),
    ).toBe(clientPasswordHash('co.lan', 'Mật khẩu 1!'));
    expect(clientPasswordHash('a', 'b')).toMatch(CLIENT_HASH);
  });
});
