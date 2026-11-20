import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ _id: false })
export class AnswerDetail {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Question',
    required: true,
  })
  questionId: Types.ObjectId;

  /** string (multiple choice) | {left,right}[] (matching) | null when skipped. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  studentAnswer: unknown;

  @Prop({ type: Boolean, required: true })
  isCorrect: boolean;
}
export const AnswerDetailSchema = SchemaFactory.createForClass(AnswerDetail);

/** One finished attempt of one quiz by one student. */
@Schema({ collection: 'student_progress' })
export class StudentProgress {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  studentId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
    index: true,
  })
  quizId: Types.ObjectId;

  /** Set when the attempt is for homework. null = quest-map practice. */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assignment',
    default: null,
  })
  assignmentId: Types.ObjectId | null;

  /** Percentage 0-100. */
  @Prop({ type: Number, required: true, min: 0, max: 100 })
  score: number;

  @Prop({ type: Number, required: true })
  correctCount: number;

  @Prop({ type: Number, required: true })
  totalQuestions: number;

  /** score >= PASS_SCORE. A passed station unlocks the next one on the map. */
  @Prop({ type: Boolean, default: false })
  passed: boolean;

  /** XP gained by this attempt = improvement over the previous best score. */
  @Prop({ type: Number, default: 0 })
  xpEarned: number;

  /** True when this attempt passed the station for the first time. */
  @Prop({ type: Boolean, default: false })
  leveledUp: boolean;

  /** Student level right after this attempt. */
  @Prop({ type: Number, default: 1 })
  levelAfter: number;

  /** Server-measured time from session start to finish, in seconds. */
  @Prop({ type: Number })
  durationSec?: number;

  @Prop({ type: [AnswerDetailSchema], default: [] })
  details: AnswerDetail[];

  @Prop({ type: Date, default: Date.now })
  completedAt: Date;
}

export type StudentProgressDocument = HydratedDocument<StudentProgress>;
export const StudentProgressSchema =
  SchemaFactory.createForClass(StudentProgress);
StudentProgressSchema.index({ studentId: 1, completedAt: -1 });
StudentProgressSchema.index({ studentId: 1, quizId: 1, score: -1 });
// Leaderboard by period: sum xpEarned of attempts completed after a date.
StudentProgressSchema.index({ completedAt: -1, xpEarned: 1 });
// Homework submissions (assignments, analytics).
StudentProgressSchema.index({ assignmentId: 1, studentId: 1, completedAt: 1 });
