import type { QuestionDto } from './dto/question.dto.js';
import { assertValidQuestionContent } from './question-content.validator.js';
import { QuestionType } from './question-types.js';

const base = { topic: 'Animals', gradeLevel: 2 };
const dto = (d: Partial<QuestionDto>) => ({ ...base, ...d }) as QuestionDto;

describe('assertValidQuestionContent — fill in the blank', () => {
  it('normalises the blank and de-duplicates accepted answers', () => {
    const c = assertValidQuestionContent(
      dto({
        type: QuestionType.FILL_IN_BLANK,
        questionText: 'I have a _____ .',
        acceptedAnswers: [' cat ', 'Cat', 'kitten'],
      }),
    );
    expect(c).toEqual({
      questionText: 'I have a ___ .',
      correctAnswer: ['cat', 'kitten'],
      options: undefined,
      pairs: undefined,
    });
  });

  it('requires exactly one blank', () => {
    for (const questionText of ['No blank here', 'Two ___ and ___']) {
      expect(() =>
        assertValidQuestionContent(
          dto({
            type: QuestionType.FILL_IN_BLANK,
            questionText,
            acceptedAnswers: ['x'],
          }),
        ),
      ).toThrow('đúng một chỗ trống');
    }
  });

  it('checks the word bank contains an answer', () => {
    expect(() =>
      assertValidQuestionContent(
        dto({
          type: QuestionType.FILL_IN_BLANK,
          questionText: 'A ___ can fly.',
          acceptedAnswers: ['bird'],
          options: ['fish', 'dog'],
        }),
      ),
    ).toThrow('từ gợi ý');
    const ok = assertValidQuestionContent(
      dto({
        type: QuestionType.FILL_IN_BLANK,
        questionText: 'A ___ can fly.',
        acceptedAnswers: ['bird'],
        options: ['Bird', 'fish'],
      }),
    );
    expect(ok.options).toEqual(['Bird', 'fish']);
  });
});

describe('assertValidQuestionContent — ordering', () => {
  it('keeps the words in the right order', () => {
    const c = assertValidQuestionContent(
      dto({
        type: QuestionType.ORDERING,
        questionText: 'Sắp xếp thành câu đúng',
        orderedItems: ['I ', ' like', 'cats'],
      }),
    );
    expect(c.correctAnswer).toEqual(['I', 'like', 'cats']);
  });

  it('refuses items that cannot be re-ordered', () => {
    expect(() =>
      assertValidQuestionContent(
        dto({
          type: QuestionType.ORDERING,
          questionText: 'x',
          orderedItems: ['go', 'Go'],
        }),
      ),
    ).toThrow('khác nhau');
  });
});
