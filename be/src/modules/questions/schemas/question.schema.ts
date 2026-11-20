import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  type MatchPair,
  QuestionSkill,
  QuestionType,
  YleLevel,
} from '../question-types.js';

@Schema({ _id: false })
export class MatchPairEntity implements MatchPair {
  @Prop({ type: String, required: true, trim: true })
  left: string;

  @Prop({ type: String, required: true, trim: true })
  right: string;
}
const MatchPairSchema = SchemaFactory.createForClass(MatchPairEntity);

/**
 * One question in the shared bank. Content fields depend on `type`:
 * - multiple_choice: `options` + `correctAnswer` (string, one of options)
 * - matching:        `pairs` (the pairs ARE the answer key; correctAnswer unused)
 * - fill_in_blank:   `questionText` with one "___"; `correctAnswer` (string[] of
 *                    accepted answers); optional `options` = word bank
 * - ordering:        `correctAnswer` (string[] in the right order)
 */
@Schema({ timestamps: true, collection: 'questions' })
export class Question {
  @Prop({ type: String, required: true, trim: true, index: true })
  topic: string;

  @Prop({ type: Number, required: true, min: 1, max: 5, index: true })
  gradeLevel: number;

  @Prop({ type: String, enum: Object.values(QuestionType), required: true })
  type: QuestionType;

  @Prop({
    type: String,
    enum: Object.values(QuestionSkill),
    default: QuestionSkill.VOCABULARY,
  })
  skill: QuestionSkill;

  @Prop({ type: String, required: true, trim: true })
  questionText: string;

  /** Optional illustration: an uploaded image or an external http(s) URL. */
  @Prop({ type: String })
  mediaUrl?: string;

  /**
   * English text of a listening question. Teachers only: it often IS the
   * answer, so students get `audioUrl` instead (plan D16).
   */
  @Prop({ type: String, trim: true })
  audioText?: string;

  /** Text-to-speech MP3 of `audioText`; missing = not made yet (TTS off or failed). */
  @Prop({ type: String })
  audioUrl?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, enum: Object.values(YleLevel) })
  yleLevel?: YleLevel;

  /** Textbook unit, e.g. "Unit 3". */
  @Prop({ type: String, trim: true })
  unit?: string;

  /** Stable id of curated content (seed:content); re-imports update instead of duplicating. */
  @Prop({ type: String, index: { unique: true, sparse: true } })
  externalId?: string;

  @Prop({ type: [String], default: undefined })
  options?: string[];

  @Prop({ type: [MatchPairSchema], default: undefined })
  pairs?: MatchPair[];

  @Prop({ type: MongooseSchema.Types.Mixed })
  correctAnswer?: unknown;

  /** Short hint shown after a wrong answer. */
  @Prop({ type: String })
  explanation?: string;

  /** null => system question (seeded / admin-curated). */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  createdBy: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export type QuestionDocument = HydratedDocument<Question>;
export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.index({ questionText: 'text' });
