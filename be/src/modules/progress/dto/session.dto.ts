import { IsDefined, IsMongoId, IsOptional } from 'class-validator';

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
   * Graders treat any unexpected shape as a wrong answer.
   */
  @IsDefined()
  studentAnswer: unknown;
}
