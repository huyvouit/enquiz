/**
 * In-memory sliding-window counter (plan 5 L4/L11, launch A3/A4). One Cloud Run instance
 * (D19), so memory is enough; move to Redis with the socket adapter.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** True while `key` has made fewer than `limit` hits in the window. */
  allowed(key: string, now = Date.now()): boolean {
    return this.recent(key, now).length < this.limit;
  }

  /** Records one hit; returns whether it was still within the limit. */
  hit(key: string, now = Date.now()): boolean {
    const recent = this.recent(key, now);
    recent.push(now);
    this.hits.set(key, recent);
    return recent.length <= this.limit;
  }

  /** Drops keys with no hit in the window (call from time to time). */
  prune(now = Date.now()): void {
    for (const key of this.hits.keys()) {
      if (this.recent(key, now).length === 0) this.hits.delete(key);
    }
  }

  private recent(key: string, now: number): number[] {
    const kept = (this.hits.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (kept.length === 0) this.hits.delete(key);
    else this.hits.set(key, kept);
    return kept;
  }
}
