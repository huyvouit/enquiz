import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const CLASS_MAX_STUDENTS = 60;
export const CLASS_MAX_GROUPS = 10;

export enum ClassStatus {
  ACTIVE = 'active',
  /** Hidden from lists, code no longer works; data kept for reports. */
  ARCHIVED = 'archived',
}

/** A named subset of the class, e.g. "Nhóm cần kèm". Used to assign work. */
@Schema()
export class ClassGroup {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  /** Always a subset of the class's studentIds. */
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }] })
  studentIds: Types.ObjectId[];
}
const ClassGroupSchema = SchemaFactory.createForClass(ClassGroup);

/**
 * A teacher's class ("Lớp 3A – Tiếng Anh"). Students join with `code` or are
 * created in bulk by the teacher. Members are embedded: a class has at most
 * CLASS_MAX_STUDENTS students, and $addToSet/$pull keep updates atomic.
 */
@Schema({ timestamps: true, collection: 'classes' })
export class ClassRoom {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  /** Invite code, 6 characters without look-alikes (0/O/1/I/L). */
  @Prop({ type: String, required: true, unique: true })
  code: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  teacherId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  gradeLevel: number;

  /** Printed on exported reports (optional). */
  @Prop({ type: String, trim: true })
  schoolName?: string;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  studentIds: Types.ObjectId[];

  @Prop({ type: [ClassGroupSchema], default: [] })
  groups: ClassGroup[];

  @Prop({
    type: String,
    enum: Object.values(ClassStatus),
    default: ClassStatus.ACTIVE,
  })
  status: ClassStatus;

  createdAt: Date;
  updatedAt: Date;
}

export type ClassRoomDocument = HydratedDocument<ClassRoom>;
export const ClassRoomSchema = SchemaFactory.createForClass(ClassRoom);
ClassRoomSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
// "Which classes is this student in?" (multikey index).
ClassRoomSchema.index({ studentIds: 1 });
