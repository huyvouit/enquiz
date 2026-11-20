import {
  answersHiddenUntil,
  averageScore,
  countStates,
  isDueSoon,
  submissionOf,
} from './assignment-status.js';

const due = new Date('2026-11-20T13:00:00Z'); // 20:00 Vietnam time
const at = (iso: string) => new Date(iso);
const before = at('2026-11-19T10:00:00Z');
const after = at('2026-11-21T10:00:00Z');

describe('submissionOf', () => {
  it('not submitted: pending before the due date, missing after', () => {
    expect(submissionOf(due, [], before)).toMatchObject({
      state: 'pending',
      score: null,
      attempts: 0,
    });
    expect(submissionOf(due, [], after).state).toBe('missing');
  });

  it('on time when at least one attempt is on or before the due date', () => {
    const s = submissionOf(
      due,
      [
        { score: 40, completedAt: at('2026-11-18T01:00:00Z') },
        { score: 70, completedAt: due }, // exactly at the deadline counts
        { score: 100, completedAt: after }, // late retry does not count
      ],
      after,
    );
    expect(s).toEqual({
      state: 'on_time',
      score: 70,
      submittedAt: at('2026-11-18T01:00:00Z'),
      attempts: 3,
      attemptId: null,
      isAutoSubmit: false,
    });
  });

  it('late when every attempt is after the due date', () => {
    const s = submissionOf(
      due,
      [
        { score: 50, completedAt: at('2026-11-21T09:00:00Z') },
        { score: 80, completedAt: at('2026-11-22T09:00:00Z') },
      ],
      after,
    );
    expect(s).toMatchObject({
      state: 'late',
      score: 80,
      submittedAt: at('2026-11-21T09:00:00Z'),
    });
  });

  it('re-classifies when the due date moves', () => {
    const attempts = [{ score: 90, completedAt: after }];
    expect(submissionOf(due, attempts, after).state).toBe('late');
    expect(
      submissionOf(at('2026-11-25T13:00:00Z'), attempts, after).state,
    ).toBe('on_time');
  });
});

describe('summaries', () => {
  it('counts states and averages counted scores', () => {
    const subs = [
      submissionOf(due, [{ score: 100, completedAt: before }], after),
      submissionOf(due, [{ score: 50, completedAt: after }], after),
      submissionOf(due, [], after),
    ];
    expect(countStates(subs)).toEqual({
      assigned: 3,
      onTime: 1,
      late: 1,
      pending: 0,
      missing: 1,
    });
    expect(averageScore(subs)).toBe(75);
    expect(averageScore([submissionOf(due, [], before)])).toBeNull();
  });

  it('is due soon only within 48 hours and before the deadline', () => {
    expect(isDueSoon(due, at('2026-11-18T14:00:00Z'))).toBe(true);
    expect(isDueSoon(due, at('2026-11-18T12:00:00Z'))).toBe(false);
    expect(isDueSoon(due, after)).toBe(false);
  });

  it('hides exam answers until the due date only when asked to', () => {
    const exam = { mode: 'exam', reveal: 'after_due', dueDate: due };
    expect(answersHiddenUntil(exam, before)).toEqual(due);
    expect(answersHiddenUntil(exam, after)).toBeNull();
    expect(
      answersHiddenUntil({ ...exam, reveal: 'after_submit' }, before),
    ).toBeNull();
    expect(answersHiddenUntil({ ...exam, mode: 'classic' }, before)).toBeNull();
  });

  it('reports an auto-submitted exam', () => {
    const s = submissionOf(
      due,
      [{ score: 30, completedAt: before, isAutoSubmit: true }],
      before,
    );
    expect(s.isAutoSubmit).toBe(true);
  });
});
