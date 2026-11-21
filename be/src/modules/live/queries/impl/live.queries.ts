import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { LiveMatchReport, LiveMatchSummary } from '../../live.mapper.js';

export class ListLiveMatchesQuery extends Query<LiveMatchSummary[]> {
  constructor(
    public readonly user: AuthUser,
    public readonly classId?: string,
  ) {
    super();
  }
}

export class GetLiveReportQuery extends Query<LiveMatchReport> {
  constructor(
    public readonly matchId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** What the join screen needs to know about a PIN before connecting. */
export interface LivePinInfo {
  quizTitle: string;
  coverEmoji: string;
  className: string | null;
  allowGuests: boolean;
  /** The match is already being played (joining late is allowed, L7). */
  started: boolean;
}

export class CheckLivePinQuery extends Query<LivePinInfo> {
  constructor(
    public readonly pin: string,
    /** `u:<userId>` or `ip:<address>`, for the wrong-PIN limit (L4). */
    public readonly key: string,
  ) {
    super();
  }
}
