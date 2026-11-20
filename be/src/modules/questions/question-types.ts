export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  MATCHING = 'matching',
  FILL_IN_BLANK = 'fill_in_blank',
  ORDERING = 'ordering',
}

/**
 * Types teachers can author. A type is added here only once both its builder
 * form and its game UI exist (all four since phase 3).
 */
export const AUTHORABLE_QUESTION_TYPES = [
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.MATCHING,
  QuestionType.FILL_IN_BLANK,
  QuestionType.ORDERING,
] as const;

/** The blank of a fill-in-the-blank question (any run of 3+ underscores is normalised to it). */
export const BLANK = '___';

/** Cambridge Young Learners English levels (Starters ≈ grades 1-2, Movers 3-4, Flyers 5). */
export enum YleLevel {
  STARTERS = 'starters',
  MOVERS = 'movers',
  FLYERS = 'flyers',
}

export enum QuestionSkill {
  VOCABULARY = 'vocabulary',
  GRAMMAR = 'grammar',
  LISTENING = 'listening',
}

export interface MatchPair {
  left: string;
  right: string;
}

/** Limits shared by DTO validation and the frontend builder. */
export const QUESTION_LIMITS = {
  minOptions: 2,
  maxOptions: 6,
  minPairs: 2,
  maxPairs: 6,
  maxAcceptedAnswers: 5,
  minOrderItems: 2,
  maxOrderItems: 10,
  maxAudioText: 200,
  maxTags: 10,
} as const;
