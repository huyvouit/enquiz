import { BadRequestException } from '@nestjs/common';
import type { QuestionDto } from './dto/question.dto.js';
import { BLANK, QuestionType } from './question-types.js';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function hasDuplicates(values: string[]): boolean {
  return new Set(values.map(norm)).size !== values.length;
}

/** Content fields stored for a question; fields of other types are cleared. */
export interface QuestionContent {
  questionText: string;
  options: string[] | undefined;
  pairs: { left: string; right: string }[] | undefined;
  correctAnswer: unknown;
}

/**
 * Cross-field rules class-validator cannot express. Throws 400 on failure.
 * Returns the persisted content fields for the question's type, so fields
 * that do not belong to the type (e.g. `pairs` on a multiple-choice) are dropped.
 */
export function assertValidQuestionContent(dto: QuestionDto): QuestionContent {
  const questionText = dto.questionText.trim();
  switch (dto.type) {
    case QuestionType.MULTIPLE_CHOICE: {
      const options = (dto.options ?? []).map((o) => o.trim());
      const answer = (dto.correctAnswer ?? '').trim();
      if (hasDuplicates(options)) {
        throw new BadRequestException('Các đáp án không được trùng nhau');
      }
      if (!options.some((o) => norm(o) === norm(answer))) {
        throw new BadRequestException(
          'Đáp án đúng phải là một trong các lựa chọn',
        );
      }
      return {
        questionText,
        options,
        correctAnswer: options.find((o) => norm(o) === norm(answer)),
        pairs: undefined,
      };
    }
    case QuestionType.MATCHING: {
      const pairs = (dto.pairs ?? []).map((p) => ({
        left: p.left.trim(),
        right: p.right.trim(),
      }));
      if (
        hasDuplicates(pairs.map((p) => p.left)) ||
        hasDuplicates(pairs.map((p) => p.right))
      ) {
        throw new BadRequestException(
          'Mỗi vế trái/phải trong bài nối từ phải khác nhau',
        );
      }
      return {
        questionText,
        pairs,
        options: undefined,
        correctAnswer: undefined,
      };
    }
    case QuestionType.FILL_IN_BLANK: {
      // Any run of 3+ underscores is the blank; there must be exactly one.
      const text = questionText.replace(/_{3,}/g, BLANK);
      if (text.split(BLANK).length !== 2) {
        throw new BadRequestException(
          `Câu điền từ cần đúng một chỗ trống, viết bằng ${BLANK}`,
        );
      }
      // Keep the first spelling the teacher typed for each answer.
      const seen = new Set<string>();
      const accepted = (dto.acceptedAnswers ?? [])
        .map((a) => a.trim().replace(/\s+/g, ' '))
        .filter((a) => a !== '' && !seen.has(norm(a)) && seen.add(norm(a)));
      if (accepted.length === 0) {
        throw new BadRequestException('Hãy nhập ít nhất một đáp án đúng');
      }
      let options: string[] | undefined;
      if (dto.options && dto.options.length > 0) {
        // A word bank: children tap a word instead of typing (grades 1-3).
        options = dto.options.map((o) => o.trim());
        if (hasDuplicates(options)) {
          throw new BadRequestException('Các từ gợi ý không được trùng nhau');
        }
        if (!accepted.some((a) => options!.some((o) => norm(o) === norm(a)))) {
          throw new BadRequestException(
            'Đáp án đúng phải có trong các từ gợi ý',
          );
        }
      }
      return {
        questionText: text,
        options,
        correctAnswer: accepted,
        pairs: undefined,
      };
    }
    case QuestionType.ORDERING: {
      const items = (dto.orderedItems ?? []).map((w) =>
        w.trim().replace(/\s+/g, ' '),
      );
      if (items.some((w) => w === '')) {
        throw new BadRequestException('Các phần cần sắp xếp không được trống');
      }
      if (new Set(items.map(norm)).size < 2) {
        throw new BadRequestException(
          'Cần ít nhất 2 phần khác nhau để sắp xếp',
        );
      }
      return {
        questionText,
        correctAnswer: items,
        options: undefined,
        pairs: undefined,
      };
    }
    default:
      throw new BadRequestException(
        `Chưa hỗ trợ tạo dạng câu hỏi ${String(dto.type)}`,
      );
  }
}
