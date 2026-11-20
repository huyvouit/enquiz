import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export enum QuizStatus {
  /** Only the author (and admins) can see it; can still be assigned to the author's classes. */
  DRAFT = 'draft',
  /**
   * System quiz: a station on the quest map.
   * Teacher quiz: shared with other teachers (students get it as homework).
   */
  PUBLISHED = 'published',
}

@Schema({ _id: false })
export class QuizSettings {
  @Prop({ type: Boolean, default: false })
  shuffleQuestions: boolean;

  /** Suggested time for an exam of this quiz, in seconds (plan E6). */
  @Prop({ type: Number, default: null })
  timeLimitSec?: number | null;
}
const QuizSettingsSchema = SchemaFactory.createForClass(QuizSettings);

@Schema({ timestamps: true, collection: 'quizzes' })
export class Quiz {
  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String, required: true, trim: true, index: true })
  topic: string;

  @Prop({ type: Number, required: true, min: 1, max: 5, index: true })
  gradeLevel: number;

  /** Emoji shown on the quiz card, e.g. "🐶". Keeps the UI asset-free. */
  @Prop({ type: String, default: '📘' })
  coverEmoji: string;

  /** Ordered references into the question bank. */
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Question' }],
    default: [],
  })
  questionIds: Types.ObjectId[];

  @Prop({
    type: String,
    enum: Object.values(QuizStatus),
    default: QuizStatus.PUBLISHED,
    index: true,
  })
  status: QuizStatus;

  @Prop({ type: QuizSettingsSchema, default: () => ({}) })
  settings: QuizSettings;

  /** Position on the grade's quest map (system quizzes only, set by admins). */
  @Prop({ type: Number })
  mapOrder?: number;

  /** null => system quiz (seeded / admin-curated). */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  createdBy: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export type QuizDocument = HydratedDocument<Quiz>;
export const QuizSchema = SchemaFactory.createForClass(Quiz);
QuizSchema.index({ questionIds: 1 });
// Quest map: published system quizzes of a grade in map order.
QuizSchema.index({ createdBy: 1, status: 1, gradeLevel: 1, mapOrder: 1 });
