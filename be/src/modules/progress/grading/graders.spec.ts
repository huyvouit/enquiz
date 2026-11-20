import { QuestionType } from '../../questions/question-types.js';
import { computeScore, gradeAnswer, revealAnswer } from './graders.js';

describe('gradeAnswer', () => {
  describe('multiple_choice', () => {
    const q = {
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['Dog', 'Cat', 'Bird'],
      correctAnswer: 'Cat',
    };

    it('accepts the right option ignoring case and spaces', () => {
      expect(gradeAnswer(q, 'Cat')).toBe(true);
      expect(gradeAnswer(q, '  cat ')).toBe(true);
    });

    it('rejects wrong or malformed answers', () => {
      expect(gradeAnswer(q, 'Dog')).toBe(false);
      expect(gradeAnswer(q, null)).toBe(false);
      expect(gradeAnswer(q, ['Cat'])).toBe(false);
      expect(gradeAnswer(q, { value: 'Cat' })).toBe(false);
    });
  });

  describe('matching', () => {
    const q = {
      type: QuestionType.MATCHING,
      pairs: [
        { left: '🐶', right: 'dog' },
        { left: '🐱', right: 'cat' },
      ],
    };

    it('accepts all pairs matched, in any order', () => {
      expect(
        gradeAnswer(q, [
          { left: '🐱', right: 'Cat' },
          { left: '🐶', right: 'dog' },
        ]),
      ).toBe(true);
    });

    it('rejects a partially wrong match', () => {
      expect(
        gradeAnswer(q, [
          { left: '🐶', right: 'cat' },
          { left: '🐱', right: 'dog' },
        ]),
      ).toBe(false);
    });

    it('rejects missing pairs, duplicates and malformed input', () => {
      expect(gradeAnswer(q, [{ left: '🐶', right: 'dog' }])).toBe(false);
      expect(
        gradeAnswer(q, [
          { left: '🐶', right: 'dog' },
          { left: '🐶', right: 'dog' },
        ]),
      ).toBe(false);
      expect(gradeAnswer(q, 'dog')).toBe(false);
      expect(gradeAnswer(q, [null, 1])).toBe(false);
    });
  });

  it('fill_in_blank accepts any listed answer', () => {
    const q = {
      type: QuestionType.FILL_IN_BLANK,
      correctAnswer: ['grey', 'gray'],
    };
    expect(gradeAnswer(q, 'Gray')).toBe(true);
    expect(gradeAnswer(q, 'green')).toBe(false);
  });

  it('ordering requires the exact order', () => {
    const q = {
      type: QuestionType.ORDERING,
      correctAnswer: ['I', 'like', 'cats'],
    };
    expect(gradeAnswer(q, ['I', 'like', 'cats'])).toBe(true);
    expect(gradeAnswer(q, ['like', 'I', 'cats'])).toBe(false);
    expect(gradeAnswer(q, ['I', 'like'])).toBe(false);
  });
});

describe('revealAnswer', () => {
  it('returns the pairs for matching questions', () => {
    expect(
      revealAnswer({
        type: QuestionType.MATCHING,
        pairs: [{ left: 'a', right: 'b' }],
      }),
    ).toEqual([{ left: 'a', right: 'b' }]);
  });
});

describe('computeScore', () => {
  it('returns a rounded percentage', () => {
    expect(computeScore(2, 3)).toBe(67);
    expect(computeScore(0, 0)).toBe(0);
    expect(computeScore(5, 5)).toBe(100);
  });
});
