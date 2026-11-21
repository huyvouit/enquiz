import { validateEnv } from './env.validation.js';

const base = { MONGODB_URI: 'mongodb://x/db', JWT_SECRET: 'x'.repeat(32) };

describe('LIVE_TRUST_PROXY', () => {
  it('defaults to TRUST_PROXY (dev, tests)', () => {
    expect(validateEnv({ ...base, TRUST_PROXY: '2' }).LIVE_TRUST_PROXY).toBe(2);
    expect(validateEnv(base).LIVE_TRUST_PROXY).toBe(0);
  });

  it('can be one proxy fewer than HTTP (socket straight to Cloud Run)', () => {
    const env = validateEnv({
      ...base,
      TRUST_PROXY: '2',
      LIVE_TRUST_PROXY: '1',
    });
    expect([env.TRUST_PROXY, env.LIVE_TRUST_PROXY]).toEqual([2, 1]);
  });

  it('rejects a negative or non-integer value', () => {
    expect(() => validateEnv({ ...base, LIVE_TRUST_PROXY: '-1' })).toThrow(
      /LIVE_TRUST_PROXY/,
    );
    expect(() => validateEnv({ ...base, LIVE_TRUST_PROXY: 'x' })).toThrow(
      /LIVE_TRUST_PROXY/,
    );
  });
});
