import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { AnswerDetail, AnswerDetailSchema } from './student-progress.schema.js';

/** Unfinished sessions are dropped automatically after this many hours. */
export const SESSION_TTL_HOURS = 24;

/**
 * A quiz being played right now. Each answer is graded the moment it is sent
 * (instant feedback) and locked: the first answer to a question is final.
 * Finishing turns the session into a StudentProgress record and deletes it.
 */
@Schema({ collection: 'quiz_sessions' })
export class QuizSession {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  studentId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Quiz', required: true })
  quizId: Types.ObjectId;

  /** Set when playing a homework; null when playing the quest map. */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assignment',
    default: null,
  })
  assignmentId: Types.ObjectId | null;

  @Prop({ type: [AnswerDetailSchema], default: [] })
  answers: AnswerDetail[];

  @Prop({ type: Date, default: Date.now })
  startedAt: Date;

  @Prop({
    type: Date,
    default: () => new Date(Date.now() + SESSION_TTL_HOURS * 3600_000),
  })
  expiresAt: Date;
}

export type QuizSessionDocument = HydratedDocument<QuizSession>;
export const QuizSessionSchema = SchemaFactory.createForClass(QuizSession);
// One open session per student, quiz and homework (map play = null), so the
// same quiz can be open on the map and as homework without clashing.
QuizSessionSchema.index(
  { studentId: 1, quizId: 1, assignmentId: 1 },
  { unique: true },
);
// MongoDB TTL: removes the document once expiresAt is reached.
QuizSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
