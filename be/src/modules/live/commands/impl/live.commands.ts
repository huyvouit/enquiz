import { Command } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { CreateLiveMatchDto } from '../../dto/live.dto.js';

export interface CreatedLiveMatch {
  matchId: string;
  pin: string;
  /** Multiple-choice questions that will be played (L1). */
  playableCount: number;
  /** Other question types, left out. */
  skippedCount: number;
}

/** Opens a room in memory and returns its PIN (UC1). */
export class CreateLiveMatchCommand extends Command<CreatedLiveMatch> {
  constructor(
    public readonly dto: CreateLiveMatchDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
