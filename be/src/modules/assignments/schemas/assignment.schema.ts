import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export enum AssignmentStatus {
  ACTIVE = 'active',
  /** Closed by the teacher: no more submissions, results stay. */
  CLOSED = 'closed',
}

export type AssignmentTargetKind = 'class' | 'group' | 'students';

/** classic: practice with instant feedback. exam: timed test (plan 4.2). */
export enum AssignmentMode {
  CLASSIC = 'classic',
  EXAM = 'exam',
}

/** When an exam shows the correct answers to students (plan E12). */
export enum RevealPolicy {
  AFTER_SUBMIT = 'after_submit',
  AFTER_DUE = 'after_due',
}

/** Who the homework was given to, kept for display ("Nhóm cần kèm"). */
@Schema({ _id: false })
export class AssignmentTarget {
  @Prop({ type: String, enum: ['class', 'group', 'students'], required: true })
  kind: AssignmentTargetKind;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  groupId?: Types.ObjectId;

  @Prop({ type: String })
  groupName?: string;
}
const AssignmentTargetSchema = SchemaFactory.createForClass(AssignmentTarget);

/**
 * Homework: one quiz given to (part of) a class with a due date.
 * Submission states (on time / late / not submitted) are never stored; they
 * are computed from student_progress when read (see assignment-status.ts),
 * so changing the due date re-classifies everything automatically.
 */
@Schema({ timestamps: true, collection: 'assignments' })
export class Assignment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ClassRoom',
    required: true,
  })
  classId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Quiz', required: true })
  quizId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  teacherId: Types.ObjectId;

  @Prop({ type: AssignmentTargetSchema, required: true })
  target: AssignmentTarget;

  /**
   * Students the homework is for, fixed when it is given. Students joining
   * the class later are added only to open whole-class assignments.
   */
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  studentIds: Types.ObjectId[];

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({
    type: String,
    enum: Object.values(AssignmentStatus),
    default: AssignmentStatus.ACTIVE,
  })
  status: AssignmentStatus;

  /** Missing on homework given before phase 4.2: read as classic. */
  @Prop({
    type: String,
    enum: Object.values(AssignmentMode),
    default: AssignmentMode.CLASSIC,
  })
  mode: AssignmentMode;

  /** Exam only: time for one attempt, in seconds (plan E6). */
  @Prop({ type: Number })
  timeLimitSec?: number;

  /** Exam only (plan E12). Missing = after_submit. */
  @Prop({
    type: String,
    enum: Object.values(RevealPolicy),
    default: RevealPolicy.AFTER_SUBMIT,
  })
  reveal: RevealPolicy;

  /** Message from the teacher shown to students. */
  @Prop({ type: String, trim: true })
  note?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type AssignmentDocument = HydratedDocument<Assignment>;
export const AssignmentSchema = SchemaFactory.createForClass(Assignment);
AssignmentSchema.index({ classId: 1, dueDate: -1 });
// A student's homework list and reminders.
AssignmentSchema.index({ studentIds: 1, dueDate: 1 });
AssignmentSchema.index({ quizId: 1 });
