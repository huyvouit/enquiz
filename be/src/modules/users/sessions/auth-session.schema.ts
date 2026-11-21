import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * One login on one browser (plan D22). Its `_id` is the session id (`sid`)
 * carried by every access token. The refresh token itself is never stored,
 * only its SHA-256; it is replaced on every refresh (rotation), and the
 * previous hash is kept to recognise a stolen token being replayed.
 */
@Schema({
  collection: 'auth_sessions',
  timestamps: { createdAt: true, updatedAt: false },
})
export class AuthSession {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  tokenHash: string;

  /** The token this one replaced: seen again = replay (or a lost response). */
  @Prop({ type: String, index: { sparse: true } })
  prevHash?: string;

  @Prop({ type: Date })
  rotatedAt?: Date;

  /** "Remember me": sliding expiry and a persistent cookie. */
  @Prop({ type: Boolean, required: true })
  remember: boolean;

  /** MongoDB deletes the document once this is past (TTL index). */
  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt: Date;

  /** The sliding expiry never goes past this. */
  @Prop({ type: Date, required: true })
  maxExpiresAt: Date;

  @Prop({ type: Date, required: true })
  lastUsedAt: Date;

  /** Shortened User-Agent, to tell sessions apart. No IP is kept. */
  @Prop({ type: String })
  userAgent?: string;

  createdAt: Date;
}

export type AuthSessionDocument = HydratedDocument<AuthSession>;
export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);
