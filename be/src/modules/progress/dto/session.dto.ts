import {
  IsDefined,
  IsMongoId,
  IsOptional,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';

/** Longest answer accepted, as JSON (30 pairs of 300 characters fit). */
export const MAX_ANSWER_BYTES = 20_000;

/** Rejects a value whose JSON is longer than `max` bytes (launch A5). */
function MaxJsonBytes(max: number, options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'maxJsonBytes',
      validator: {
        validate: (value: unknown) =>
          Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8') <= max,
        defaultMessage: () => 'Câu trả lời quá dài',
      },
    },
    options,
  );
}

export class StartSessionDto {
  @IsMongoId()
  quizId: string;

  /** Play the quiz as this homework (skips quest-map locking). */
  @IsOptional()
  @IsMongoId()
  assignmentId?: string;
}

export class AnswerQuestionDto {
  @IsMongoId()
  questionId: string;

  /**
   * Shape depends on question type:
   * - multiple_choice: "Cat"
   * - matching: [{ "left": "🐶", "right": "dog" }, ...]
   * Graders treat any unexpected shape as a wrong answer, and only a clean
   * copy is stored (`cleanAnswer`, same rules as exams).
   */
  @IsDefined()
  @MaxJsonBytes(MAX_ANSWER_BYTES)
  studentAnswer: unknown;
}
