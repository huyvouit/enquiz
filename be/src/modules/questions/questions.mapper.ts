import { Types } from 'mongoose';
import type {
  MatchPair,
  QuestionSkill,
  QuestionType,
  YleLevel,
} from './question-types.js';
import type { Question } from './schemas/question.schema.js';

/** Full question including the answer key. Teachers/admins only. */
export interface QuestionView {
  id: string;
  topic: string;
  gradeLevel: number;
  type: QuestionType;
  skill: QuestionSkill;
  questionText: string;
  mediaUrl?: string;
  audioText?: string;
  tags: string[];
  yleLevel?: YleLevel;
  unit?: string;
  options?: string[];
  pairs?: MatchPair[];
  correctAnswer?: unknown;
  explanation?: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toQuestionView(
  q: Question & { _id: Types.ObjectId },
): QuestionView {
  return {
    id: q._id.toString(),
    topic: q.topic,
    gradeLevel: q.gradeLevel,
    type: q.type,
    skill: q.skill,
    questionText: q.questionText,
    mediaUrl: q.mediaUrl,
    audioText: q.audioText,
    tags: q.tags ?? [],
    yleLevel: q.yleLevel,
    unit: q.unit,
    options: q.options,
    pairs: q.pairs?.map((p) => ({ left: p.left, right: p.right })),
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    createdBy: q.createdBy ? q.createdBy.toString() : null,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}
