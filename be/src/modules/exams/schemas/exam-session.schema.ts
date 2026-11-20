import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export enum ExamStatus {
  IN_PROGRESS = 'in_progress',
  /** Handed in before the deadline + grace (by the student or the timer). */
  SUBMITTED = 'submitted',
  /** Closed by the server after the deadline: the saved draft was graded. */
  TIMED_OUT = 'timed_out',
}

/** Where the exam comes from. Only homework for now (plan E9). */
export type ExamKind = 'assignment' | 'challenge';

@Schema({ _id: false })
export class ExamAnswer {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  questionId: Types.ObjectId;

  /** Same shapes as AnswerDetail.studentAnswer. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  answer: unknown;
}
const ExamAnswerSchema = SchemaFactory.createForClass(ExamAnswer);

/**
 * One student's single attempt at an exam (plan 4.2). Never deleted: it is
 * the proof the attempt was used (E8). The graded result itself is a
 * student_progress record (E7), linked by progressId.
 */
@Schema({ collection: 'exam_sessions', timestamps: true })
export class ExamSession {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  studentId: Types.ObjectId;

  @Prop({ type: String, enum: ['assignment', 'challenge'], required: true })
  kind: ExamKind;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assignment',
    required: true,
  })
  assignmentId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Quiz', required: true })
  quizId: Types.ObjectId;

  /** The questions, in the order this student sees them (E10). */
  @Prop({ type: [MongooseSchema.Types.ObjectId], required: true })
  questionIds: Types.ObjectId[];

  @Prop({ type: Number, required: true })
  timeLimitSec: number;

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date, required: true })
  deadlineAt: Date;

  @Prop({
    type: String,
    enum: Object.values(ExamStatus),
    default: ExamStatus.IN_PROGRESS,
  })
  status: ExamStatus;

  /** Draft while in progress (E2), the graded answers afterwards. */
  @Prop({ type: [ExamAnswerSchema], default: [] })
  answers: ExamAnswer[];

  /** "Đánh dấu xem lại". */
  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  flagged: Types.ObjectId[];

  @Prop({ type: Date, default: null })
  draftSavedAt: Date | null;

  @Prop({ type: Date, default: null })
  submittedAt: Date | null;

  @Prop({ type: Boolean, default: false })
  isAutoSubmit: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  progressId: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export type ExamSessionDocument = HydratedDocument<ExamSession>;
export type ExamSessionDoc = ExamSession & { _id: Types.ObjectId };
export const ExamSessionSchema = SchemaFactory.createForClass(ExamSession);
// One attempt per student and exam (E8); also stops a double "Bắt đầu".
ExamSessionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
ExamSessionSchema.index({ studentId: 1, status: 1 });
// Lazy close of sessions past their deadline (E5).
ExamSessionSchema.index({ status: 1, deadlineAt: 1 });
