import { authThrottlers, usernameTracker } from './auth-throttle.js';

describe('usernameTracker', () => {
  it('keys on the normalised username', () => {
    const a = usernameTracker({ ip: '1.1.1.1', body: { username: ' BeNa ' } });
    const b = usernameTracker({ ip: '2.2.2.2', body: { username: 'bena' } });
    expect(a).toBe('user:bena');
    expect(b).toBe(a);
  });

  it('falls back to the IP without a username', () => {
    expect(usernameTracker({ ip: '1.1.1.1', body: {} })).toBe('ip:1.1.1.1');
    expect(usernameTracker({ ip: '1.1.1.1', body: { username: '  ' } })).toBe(
      'ip:1.1.1.1',
    );
    expect(usernameTracker({ ip: '1.1.1.1' })).toBe('ip:1.1.1.1');
  });
});

describe('authThrottlers', () => {
  it('limits per username and, more loosely, per IP', () => {
    const [user, ip] = authThrottlers(10, 100);
    expect(user).toMatchObject({ name: 'user', ttl: 60_000, limit: 10 });
    expect(user.getTracker).toBe(usernameTracker);
    expect(ip).toMatchObject({ name: 'ip', ttl: 60_000, limit: 100 });
    expect(ip.getTracker).toBeUndefined();
  });
});
