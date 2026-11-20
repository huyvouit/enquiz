import { Types } from 'mongoose';
import { shuffle } from '../../common/utils/shuffle.js';
import { QuestionType } from '../questions/question-types.js';
import type { QuestionView } from '../questions/questions.mapper.js';
import type { Question } from '../questions/schemas/question.schema.js';
import type { Quiz, QuizStatus } from './schemas/quiz.schema.js';

type QuizDoc = Quiz & { _id: Types.ObjectId };
type QuestionDoc = Question & { _id: Types.ObjectId };

export interface QuizAuthor {
  id: string;
  fullName: string;
}

/** Card-level data for lists. */
export interface QuizSummary {
  id: string;
  title: string;
  description?: string;
  topic: string;
  gradeLevel: number;
  coverEmoji: string;
  status: QuizStatus;
  questionCount: number;
  author: QuizAuthor | null;
  createdAt: Date;
}

/** Teacher view: summary + full questions with answer keys. */
export interface QuizDetail extends QuizSummary {
  settings: { shuffleQuestions: boolean };
  questions: QuestionView[];
}

/** A question as a student sees it while playing. Contains NO answer key. */
export interface PlayQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  mediaUrl?: string;
  /**
   * Listening: the recorded audio. Never the text (`audioText`), which often
   * is the answer (plan D16). Missing while the audio is not made yet.
   */
  audioUrl?: string;
  /** Listening question whose audio is not made yet: the game says so. */
  audioPending?: true;
  /** multiple_choice: shuffled choices. fill_in_blank: shuffled word bank (if any). */
  options?: string[];
  /** matching: left column in authored order, right column shuffled. */
  matching?: { lefts: string[]; rights: string[] };
  /** ordering: the pieces, never in the correct order (when avoidable). */
  ordering?: { items: string[] };
}

export interface PlayQuiz {
  id: string;
  title: string;
  topic: string;
  gradeLevel: number;
  coverEmoji: string;
  questions: PlayQuestion[];
}

export function toQuizSummary(
  quiz: QuizDoc,
  author: QuizAuthor | null,
): QuizSummary {
  return {
    id: quiz._id.toString(),
    title: quiz.title,
    description: quiz.description,
    topic: quiz.topic,
    gradeLevel: quiz.gradeLevel,
    coverEmoji: quiz.coverEmoji,
    status: quiz.status,
    questionCount: quiz.questionIds.length,
    author,
    createdAt: quiz.createdAt,
  };
}

/** Only the fields the game needs (matches the projection in GetPlayQuizHandler). */
export type PlayableQuestionDoc = Pick<
  QuestionDoc,
  | '_id'
  | 'type'
  | 'questionText'
  | 'mediaUrl'
  | 'audioText'
  | 'audioUrl'
  | 'options'
  | 'pairs'
  | 'correctAnswer'
>;

export function toPlayQuestion(q: PlayableQuestionDoc): PlayQuestion {
  const base: PlayQuestion = {
    id: q._id.toString(),
    type: q.type,
    questionText: q.questionText,
    mediaUrl: q.mediaUrl,
    audioUrl: q.audioUrl,
    // audioText is read only to know a listening question lacks its audio.
    ...(q.audioText && !q.audioUrl ? { audioPending: true as const } : {}),
  };
  switch (q.type) {
    case QuestionType.MULTIPLE_CHOICE:
      return { ...base, options: shuffle(q.options ?? []) };
    case QuestionType.FILL_IN_BLANK:
      return q.options?.length
        ? { ...base, options: shuffle(q.options) }
        : base;
    case QuestionType.ORDERING: {
      // correctAnswer is read here only to scramble it; it is never sent.
      const items = Array.isArray(q.correctAnswer)
        ? (q.correctAnswer as string[])
        : [];
      return { ...base, ordering: { items: scramble(items) } };
    }
    case QuestionType.MATCHING: {
      const pairs = q.pairs ?? [];
      return {
        ...base,
        matching: {
          lefts: pairs.map((p) => p.left),
          rights: shuffle(pairs.map((p) => p.right)),
        },
      };
    }
    default:
      return base;
  }
}

/** Shuffles until the order differs from the original (when the items allow it). */
export function scramble(items: string[]): string[] {
  if (new Set(items).size < 2) return [...items];
  for (let i = 0; i < 10; i++) {
    const s = shuffle(items);
    if (s.some((v, j) => v !== items[j])) return s;
  }
  return [...items.slice(1), items[0]];
}

/** Returns questions in the quiz's authored order (Mongo `$in` does not keep order). */
export function orderByIds<T extends { _id: Types.ObjectId }>(
  ids: Types.ObjectId[],
  docs: T[],
): T[] {
  const byId = new Map(docs.map((d) => [d._id.toString(), d]));
  return ids
    .map((id) => byId.get(id.toString()))
    .filter((d): d is T => d !== undefined);
}
