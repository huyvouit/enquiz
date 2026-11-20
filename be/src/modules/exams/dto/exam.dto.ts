import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { QUIZ_MAX_QUESTIONS } from '../../quizzes/dto/quiz.dto.js';

export class StartExamDto {
  @IsMongoId()
  assignmentId: string;
}

export class ExamAnswerDto {
  @IsMongoId()
  questionId: string;

  /**
   * Same shapes as practice answers (string, string[], {left,right}[]);
   * null or empty = not answered. Unexpected shapes are dropped
   * (see cleanAnswers), never an error: a draft must always save.
   */
  @IsOptional()
  answer: unknown;
}

/** Draft save (plan E2): the whole answer sheet each time. */
export class ExamAnswersDto {
  @IsArray()
  @ArrayMaxSize(QUIZ_MAX_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => ExamAnswerDto)
  answers: ExamAnswerDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(QUIZ_MAX_QUESTIONS)
  @IsMongoId({ each: true })
  flagged?: string[];
}

export class SubmitExamDto extends ExamAnswersDto {
  /** Sent by the client's timer when time runs out. */
  @IsOptional()
  @IsBoolean()
  isAutoSubmit?: boolean;
}
