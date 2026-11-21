import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  Matches,
} from 'class-validator';

/** Seconds per question a host can pick (L6). */
export const QUESTION_TIMES = [10, 20, 30, 60] as const;
/** Reveal and leaderboard length when auto-advance is on (L5). */
export const AUTO_ADVANCE_SEC = 5;

export class CreateLiveMatchDto {
  @IsMongoId()
  quizId: string;

  /** Class-bound room (L3): only its students (and guests if allowed). */
  @IsOptional()
  @IsMongoId()
  classId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(QUESTION_TIMES)
  questionTimeSec?: number;

  /** Guests without an account (L11). Off by default. */
  @IsOptional()
  @IsBoolean()
  allowGuests?: boolean;

  /** Reveal and leaderboard move on by themselves after 5 seconds. */
  @IsOptional()
  @IsBoolean()
  autoAdvance?: boolean;
}

export class ListLiveMatchesDto {
  @IsOptional()
  @IsMongoId()
  classId?: string;
}

export class PinParamDto {
  @Matches(/^\d{6}$/, { message: 'Mã PIN gồm 6 chữ số' })
  pin: string;
}
