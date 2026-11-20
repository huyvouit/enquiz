import {
  answerKey,
  attentionReasons,
  formatAnswer,
  resolveRange,
  toTenScale,
} from './analytics-rules.js';

describe('analytics rules', () => {
  it('defaults to the last 30 Vietnam days and validates ranges', () => {
    const now = new Date('2026-11-16T05:00:00Z'); // 12:00 in Vietnam
    const r = resolveRange(undefined, undefined, now);
    expect(r.to).toEqual(now);
    // 30 calendar days including today, starting at Vietnam midnight.
    expect(r.from.toISOString()).toBe('2026-10-17T17:00:00.000Z');
    expect(() => resolveRange(now, now)).toThrow();
    expect(() => resolveRange(new Date('2025-01-01T00:00:00Z'), now)).toThrow();
  });

  it('formats every answer shape for reports', () => {
    expect(formatAnswer(' Dog ')).toBe('Dog');
    expect(formatAnswer(null)).toBe('(bỏ trống)');
    expect(formatAnswer(['I', 'like', 'cats'])).toBe('I like cats');
    expect(
      formatAnswer([
        { left: '🐶', right: 'cat' },
        { left: '🐱', right: 'dog' },
      ]),
    ).toBe('🐶 → cat, 🐱 → dog');
    expect(answerKey('  DOG ')).toBe(answerKey('dog'));
  });

  it('converts to the 10-point scale', () => {
    expect(toTenScale(85)).toBe(8.5);
    expect(toTenScale(100)).toBe(10);
    expect(toTenScale(null)).toBeNull();
  });

  it('explains why a student needs attention', () => {
    const now = new Date('2026-11-16T05:00:00Z');
    expect(
      attentionReasons({
        averageScore: 45,
        missingCount: 2,
        lastActiveAt: new Date('2026-11-01T00:00:00Z'),
        now,
      }),
    ).toEqual(['Điểm TB 45', '2 bài quá hạn chưa nộp', 'Không làm bài 7 ngày']);
    expect(
      attentionReasons({
        averageScore: null,
        missingCount: 0,
        lastActiveAt: null,
        now,
      }),
    ).toEqual(['Chưa làm bài nào']);
    expect(
      attentionReasons({
        averageScore: 80,
        missingCount: 1,
        lastActiveAt: new Date('2026-11-15T00:00:00Z'),
        now,
      }),
    ).toEqual([]);
  });
});
