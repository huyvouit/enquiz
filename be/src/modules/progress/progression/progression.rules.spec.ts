import {
  isPassingScore,
  levelFromPassedCount,
  periodStart,
  stationStatuses,
  xpGain,
} from './progression.rules.js';

describe('progression rules', () => {
  it('passes at 60 points', () => {
    expect(isPassingScore(59)).toBe(false);
    expect(isPassingScore(60)).toBe(true);
  });

  it('gives XP only for improvements', () => {
    expect(xpGain(null, 40)).toBe(40);
    expect(xpGain(40, 70)).toBe(30);
    expect(xpGain(70, 50)).toBe(0);
    expect(xpGain(100, 100)).toBe(0);
  });

  it('levels up once per passed station', () => {
    expect(levelFromPassedCount(0)).toBe(1);
    expect(levelFromPassedCount(3)).toBe(4);
  });

  describe('stationStatuses', () => {
    const ids = ['a', 'b', 'c', 'd'];

    it('opens only the first station for a new student', () => {
      expect(stationStatuses(ids, new Map())).toEqual([
        'unlocked',
        'locked',
        'locked',
        'locked',
      ]);
    });

    it('opens the station after a passed one', () => {
      const progress = new Map([
        ['a', { bestScore: 80, passed: true }],
        ['b', { bestScore: 40, passed: false }],
      ]);
      expect(stationStatuses(ids, progress)).toEqual([
        'passed',
        'unlocked',
        'locked',
        'locked',
      ]);
    });

    it('never re-locks a passed station when a new one is inserted before it', () => {
      const progress = new Map([
        ['a', { bestScore: 80, passed: true }],
        ['c', { bestScore: 90, passed: true }],
      ]);
      // "b" was added later between a and c.
      expect(stationStatuses(ids, progress)).toEqual([
        'passed',
        'unlocked',
        'passed',
        'unlocked',
      ]);
    });
  });

  describe('periodStart (Vietnam time)', () => {
    // Wednesday 2026-11-18 03:00 in Vietnam = Tuesday 20:00 UTC.
    const now = new Date('2026-11-17T20:00:00Z');

    it('starts the week on Monday 00:00 Vietnam time', () => {
      expect(periodStart('week', now)?.toISOString()).toBe(
        '2026-11-15T17:00:00.000Z',
      );
    });

    it('starts the month on the 1st 00:00 Vietnam time', () => {
      expect(periodStart('month', now)?.toISOString()).toBe(
        '2026-10-31T17:00:00.000Z',
      );
    });

    it('has no start for all-time', () => {
      expect(periodStart('all', now)).toBeNull();
    });
  });
});
