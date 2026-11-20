import type { ThrottlerOptions } from '@nestjs/throttler';

const MINUTE = 60_000;

/**
 * Tracker for the per-account limit: the username being tried, normalised the
 * way the login handler looks it up. Falls back to the IP when the body has none.
 */
export function usernameTracker(req: Record<string, any>): string {
  const username: unknown = req.body?.username;
  return typeof username === 'string' && username.trim() !== ''
    ? `user:${username.trim().toLowerCase()}`
    : `ip:${req.ip}`;
}

/**
 * Two limits on the auth endpoints, both per minute:
 * - `user`: tries on one username (password guessing), AUTH_RATE_LIMIT.
 * - `ip`: requests from one address, AUTH_IP_RATE_LIMIT. Kept high because a
 *   whole school usually reaches the internet through a single IP, and a class
 *   logs in at the same moment.
 * `req.ip` is the real client only when TRUST_PROXY matches the proxy chain.
 */
export function authThrottlers(
  perUsername: number,
  perIp: number,
): ThrottlerOptions[] {
  return [
    {
      name: 'user',
      ttl: MINUTE,
      limit: perUsername,
      getTracker: usernameTracker,
    },
    { name: 'ip', ttl: MINUTE, limit: perIp },
  ];
}
