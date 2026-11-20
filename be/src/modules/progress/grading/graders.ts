import {
  type MatchPair,
  QuestionType,
} from '../../questions/question-types.js';

/** The answer-key fields a grader needs. */
export interface GradableQuestion {
  type: QuestionType;
  options?: string[];
  pairs?: MatchPair[];
  correctAnswer?: unknown;
}

/**
 * Returns true when `answer` is fully correct. Student input is untrusted,
 * so every grader must return false (never throw) on malformed answers.
 */
export type Grader = (question: GradableQuestion, answer: unknown) => boolean;

/** Case-, surrounding- and repeated-whitespace-insensitive comparison key. */
export const normalize = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

const isString = (v: unknown): v is string => typeof v === 'string';

const gradeMultipleChoice: Grader = (q, answer) =>
  isString(answer) &&
  isString(q.correctAnswer) &&
  normalize(answer) === normalize(q.correctAnswer);

/** Answer shape: `[{ left, right }]`. All pairs must be matched correctly. */
const gradeMatching: Grader = (q, answer) => {
  const key = q.pairs ?? [];
  if (
    !Array.isArray(answer) ||
    answer.length !== key.length ||
    key.length === 0
  )
    return false;

  const given = new Map<string, string>();
  for (const item of answer) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !isString((item as MatchPair).left) ||
      !isString((item as MatchPair).right)
    ) {
      return false;
    }
    const left = normalize((item as MatchPair).left);
    if (given.has(left)) return false; // same left matched twice
    given.set(left, normalize((item as MatchPair).right));
  }
  return key.every((p) => given.get(normalize(p.left)) === normalize(p.right));
};

/** correctAnswer: one accepted string or a list of accepted strings. */
const gradeFillInBlank: Grader = (q, answer) => {
  if (!isString(answer)) return false;
  const accepted = Array.isArray(q.correctAnswer)
    ? q.correctAnswer
    : [q.correctAnswer];
  return accepted.some(
    (a) => isString(a) && normalize(a) === normalize(answer),
  );
};

/** correctAnswer and answer: string[] in order. */
const gradeOrdering: Grader = (q, answer) => {
  const key = q.correctAnswer;
  return (
    Array.isArray(key) &&
    Array.isArray(answer) &&
    key.length === answer.length &&
    key.every(
      (k, i) =>
        isString(k) &&
        isString(answer[i]) &&
        normalize(k) === normalize(answer[i]),
    )
  );
};

const GRADERS: Record<QuestionType, Grader> = {
  [QuestionType.MULTIPLE_CHOICE]: gradeMultipleChoice,
  [QuestionType.MATCHING]: gradeMatching,
  [QuestionType.FILL_IN_BLANK]: gradeFillInBlank,
  [QuestionType.ORDERING]: gradeOrdering,
};

export function gradeAnswer(
  question: GradableQuestion,
  answer: unknown,
): boolean {
  const grader = GRADERS[question.type];
  return grader ? grader(question, answer) : false;
}

/** The answer key shown to the student after submitting. */
export function revealAnswer(question: GradableQuestion): unknown {
  return question.type === QuestionType.MATCHING
    ? (question.pairs ?? []).map((p) => ({ left: p.left, right: p.right }))
    : question.correctAnswer;
}

/** Percentage score 0-100, rounded. */
export function computeScore(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}
