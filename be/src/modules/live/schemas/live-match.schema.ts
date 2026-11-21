import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

/** Reports of guests' nicknames (maybe a child's real name) go after this (L11). */
export const LIVE_MATCH_TTL_DAYS = 180;

@Schema({ _id: false })
export class LiveMatchAnswer {
  @Prop({ type: Number, required: true })
  questionIndex: number;

  @Prop({ type: Number, required: true })
  choice: number;

  @Prop({ type: Boolean, required: true })
  isCorrect: boolean;

  @Prop({ type: Number, required: true })
  ms: number;

  @Prop({ type: Number, required: true })
  points: number;
}
const LiveMatchAnswerSchema = SchemaFactory.createForClass(LiveMatchAnswer);

@Schema({ _id: false })
export class LiveMatchPlayer {
  @Prop({ type: String, required: true })
  playerId: string;

  /** null for guests: nothing else about them is stored (no IP, L11). */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  userId: Types.ObjectId | null;

  @Prop({ type: String, required: true })
  nickname: string;

  @Prop({ type: Boolean, required: true })
  isGuest: boolean;

  @Prop({ type: Number, required: true })
  score: number;

  @Prop({ type: Number, required: true })
  correctCount: number;

  @Prop({ type: Number, required: true })
  rank: number;

  @Prop({ type: [LiveMatchAnswerSchema], default: [] })
  answers: LiveMatchAnswer[];
}
const LiveMatchPlayerSchema = SchemaFactory.createForClass(LiveMatchPlayer);

@Schema({ _id: false })
export class LiveMatchQuestion {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Question',
    required: true,
  })
  questionId: Types.ObjectId;

  /** Snapshot, so the report still reads well if the question changes. */
  @Prop({ type: String, required: true })
  questionText: string;

  @Prop({ type: [String], required: true })
  options: string[];

  @Prop({ type: Number, required: true })
  correctIndex: number;

  /** Players per option, in `options` order. */
  @Prop({ type: [Number], required: true })
  distribution: number[];

  @Prop({ type: Number, required: true })
  answeredCount: number;

  /** Correct answers / players in the match (0–100). */
  @Prop({ type: Number, required: true })
  correctRate: number;

  /** Average answer time of those who answered, ms (null: nobody did). */
  @Prop({ type: Number, default: null })
  avgMs: number | null;
}
const LiveMatchQuestionSchema = SchemaFactory.createForClass(LiveMatchQuestion);

/**
 * Report of one finished live match (plan 5, L8/L12). Written once, when
 * the match ends or is stopped; the live state itself only lives in memory.
 */
@Schema({ collection: 'live_matches' })
export class LiveMatch {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  hostId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Quiz', required: true })
  quizId: Types.ObjectId;

  @Prop({ type: String, required: true })
  quizTitle: string;

  @Prop({ type: String, default: '📘' })
  coverEmoji: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ClassRoom',
    default: null,
  })
  classId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  className: string | null;

  /** ended: reached the podium. aborted: closed before (idle, server). */
  @Prop({ type: String, enum: ['ended', 'aborted'], required: true })
  status: 'ended' | 'aborted';

  @Prop({ type: Object, required: true })
  settings: {
    questionTimeSec: number;
    allowGuests: boolean;
    autoAdvanceSec: number | null;
  };

  @Prop({ type: [LiveMatchQuestionSchema], default: [] })
  questions: LiveMatchQuestion[];

  @Prop({ type: [LiveMatchPlayerSchema], default: [] })
  players: LiveMatchPlayer[];

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, required: true })
  endedAt: Date;
}

export type LiveMatchDocument = HydratedDocument<LiveMatch>;
export type LiveMatchDoc = LiveMatch & { _id: Types.ObjectId };
export const LiveMatchSchema = SchemaFactory.createForClass(LiveMatch);
LiveMatchSchema.index({ hostId: 1, endedAt: -1 });
LiveMatchSchema.index({ classId: 1, endedAt: -1 });
LiveMatchSchema.index(
  { endedAt: 1 },
  { expireAfterSeconds: LIVE_MATCH_TTL_DAYS * 86_400 },
);
