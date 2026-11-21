const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** "15m", "12h", "7d" → milliseconds; NaN when the text is not like that. */
export function parseDuration(text: string): number {
  const match = /^(\d+)([smhd])$/.exec(text.trim());
  if (!match) return Number.NaN;
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}
