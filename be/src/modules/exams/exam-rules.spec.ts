import { Types } from 'mongoose';
import {
  EXAM_GRACE_MS,
  examDeadline,
  isWithinGrace,
} from '../../common/utils/exam-time.js';
import { seededRandom, shuffle } from '../../common/utils/shuffle.js';
import { QuestionType } from '../questions/question-types.js';
import { scramble } from '../quizzes/quizzes.mapper.js';
import {
  cleanAnswer,
  cleanAnswers,
  cleanFlags,
  completedAtOf,
  examDurationSec,
  gradeSheet,
} from './exam-rules.js';

const ids = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
const [q1, q2, q3] = ids;

describe('exam time (plan E1)', () => {
  const start = new Date('2026-11-20T10:00:00Z');
  const deadline = examDeadline(start, 15 * 60);

  it('ends timeLimitSec after the start', () => {
    expect(deadline.toISOString()).toBe('2026-11-20T10:15:00.000Z');
  });

  it('accepts answers until deadline + grace only', () => {
    const at = (ms: number) => new Date(deadline.getTime() + ms);
    expect(isWithinGrace(deadline, at(-1000))).toBe(true);
    expect(isWithinGrace(deadline, at(EXAM_GRACE_MS))).toBe(true);
    expect(isWithinGrace(deadline, at(EXAM_GRACE_MS + 1))).toBe(false);
  });

  it('counts a server-closed exam at its deadline (plan D7)', () => {
    const session = { deadlineAt: deadline };
    const later = new Date(deadline.getTime() + 3 * 3600_000);
    expect(completedAtOf(session, later, true)).toEqual(deadline);
    expect(completedAtOf(session, later, false)).toEqual(later);
  });

  it('never reports more time than allowed', () => {
    const session = { startedAt: start, timeLimitSec: 900 };
    expect(examDurationSec(session, new Date('2026-11-20T10:05:00Z'))).toBe(
      300,
    );
    expect(examDurationSec(session, new Date('2026-11-20T12:00:00Z'))).toBe(
      900,
    );
  });
});

describe('seeded shuffle (plan E10)', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('gives the same order for the same seed', () => {
    expect(shuffle(items, seededRandom('s1:q1'))).toEqual(
      shuffle(items, seededRandom('s1:q1')),
    );
  });

  it('differs between seeds and keeps every item', () => {
    const orders = new Set(
      ['a', 'b', 'c', 'd', 'e'].map((s) =>
        shuffle(items, seededRandom(s)).join(''),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
    expect([...shuffle(items, seededRandom('x'))].sort()).toEqual(items);
  });

  it('still scrambles ordering pieces away from the answer', () => {
    const answer = ['I', 'like', 'red', 'apples'];
    for (const seed of ['1', '2', '3', '4']) {
      expect(scramble(answer, seededRandom(seed))).not.toEqual(answer);
    }
  });
});

describe('answer cleaning', () => {
  it('keeps the four answer shapes and drops the rest', () => {
    expect(cleanAnswer('cat')).toBe('cat');
    expect(cleanAnswer(['I', 'like'])).toEqual(['I', 'like']);
    expect(cleanAnswer([{ left: 'a', right: 'b', extra: 1 }])).toEqual([
      { left: 'a', right: 'b' },
    ]);
    expect(cleanAnswer('   ')).toBeNull();
    expect(cleanAnswer([])).toBeNull();
    expect(cleanAnswer(42)).toBeNull();
    expect(cleanAnswer({ $gt: '' })).toBeNull();
    expect(cleanAnswer('x'.repeat(301))).toBeNull();
    expect(cleanAnswer(['a', { left: 'b', right: 'c' }])).toBeNull();
  });

  it('keeps the last answer per exam question, in exam order', () => {
    const other = new Types.ObjectId().toString();
    expect(
      cleanAnswers(
        [
          { questionId: q2.toString(), answer: 'first' },
          { questionId: other, answer: 'not in exam' },
          { questionId: q1.toString(), answer: 'one' },
          { questionId: q2.toString(), answer: 'second' },
          { questionId: q3.toString(), answer: 'x' },
          { questionId: q3.toString(), answer: '' }, // cleared again
        ],
        ids,
      ),
    ).toEqual([
      { questionId: q1, answer: 'one' },
      { questionId: q2, answer: 'second' },
    ]);
  });

  it('keeps flags of exam questions only', () => {
    expect(
      cleanFlags([q3.toString(), 'nope', q1.toString(), q1.toString()], ids),
    ).toEqual([q1, q3]);
    expect(cleanFlags(undefined, ids)).toEqual([]);
  });
});

describe('gradeSheet (plan E3)', () => {
  const mc = {
    _id: q1,
    type: QuestionType.MULTIPLE_CHOICE,
    options: ['cat', 'dog'],
    correctAnswer: 'cat',
  };
  const order = {
    _id: q2,
    type: QuestionType.ORDERING,
    correctAnswer: ['I', 'like', 'cats'],
  };

  it('grades the whole sheet once; blanks are wrong', () => {
    const sheet = gradeSheet([mc, order], [{ questionId: q1, answer: 'Cat ' }]);
    expect(sheet.correctCount).toBe(1);
    expect(sheet.score).toBe(50);
    expect(sheet.details).toEqual([
      { questionId: q1, studentAnswer: 'Cat ', isCorrect: true },
      { questionId: q2, studentAnswer: null, isCorrect: false },
    ]);
  });

  it('only counts questions still in the bank', () => {
    // q2 was deleted after the exam started: total is 1.
    const sheet = gradeSheet(
      [mc],
      [
        { questionId: q1, answer: 'cat' },
        { questionId: q2, answer: ['I', 'like', 'cats'] },
      ],
    );
    expect(sheet.score).toBe(100);
    expect(sheet.details).toHaveLength(1);
  });
});
