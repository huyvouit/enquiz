/** A random number generator returning values in [0, 1), like Math.random. */
export type Random = () => number;

/** Fisher-Yates shuffle. Returns a new array and never mutates the input. */
export function shuffle<T>(
  items: readonly T[],
  random: Random = Math.random,
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Deterministic generator from a text seed (FNV-1a hash + mulberry32).
 * The same seed always gives the same sequence: an exam question keeps the
 * same option order when the page is reloaded (plan E10). Not for secrets.
 */
export function seededRandom(seed: string): Random {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
