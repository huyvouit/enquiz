import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AccountStatus } from '../../../common/enums/account-status.enum.js';
import { Role } from '../../../common/enums/role.enum.js';

/** Learning progression, only present for students. */
@Schema({ _id: false })
export class StudentProfile {
  @Prop({ type: Number, required: true, min: 1, max: 5 })
  gradeLevel: number;

  /** 1 + number of distinct stations (quizzes) passed. Never goes down. */
  @Prop({ type: Number, default: 1 })
  level: number;

  /** Total XP = sum of the best score of every quiz played. */
  @Prop({ type: Number, default: 0 })
  xp: number;
}
export const StudentProfileSchema =
  SchemaFactory.createForClass(StudentProfile);

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  username: string;

  /** bcrypt hash. Excluded from queries unless explicitly selected. */
  @Prop({ type: String, required: true, select: false })
  password: string;

  @Prop({ type: String, required: true, trim: true })
  fullName: string;

  @Prop({ type: String, enum: Object.values(Role), required: true })
  role: Role;

  /** Teachers who sign up themselves start as `pending` until an admin approves. */
  @Prop({
    type: String,
    enum: Object.values(AccountStatus),
    default: AccountStatus.ACTIVE,
  })
  status: AccountStatus;

  @Prop({ type: StudentProfileSchema })
  studentProfile?: StudentProfile;

  /**
   * Last password change or reset, in whole seconds (plan D20). Tokens
   * issued before it are refused, so other devices are logged out.
   */
  @Prop({ type: Date, default: null })
  passwordChangedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
// Leaderboard "all time": students of a grade sorted by XP.
UserSchema.index({
  role: 1,
  'studentProfile.gradeLevel': 1,
  'studentProfile.xp': -1,
});
// Admin user list filtered by role/status.
UserSchema.index({ role: 1, status: 1, createdAt: -1 });
