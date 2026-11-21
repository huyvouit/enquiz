import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Role } from '../../../../common/enums/role.enum.js';
import { LiveAccessService } from '../../live-access.service.js';
import { LiveRoomRegistry } from '../../live-room.registry.js';
import {
  LiveMatchReport,
  LiveMatchSummary,
  toMatchReport,
  toMatchSummary,
} from '../../live.mapper.js';
import { LiveMatch } from '../../schemas/live-match.schema.js';
import {
  CheckLivePinQuery,
  GetLiveReportQuery,
  ListLiveMatchesQuery,
  LivePinInfo,
} from '../impl/live.queries.js';

const MATCH_NOT_FOUND = 'Không tìm thấy trận đấu';
export const PIN_NOT_FOUND = 'Không tìm thấy phòng với mã PIN này';
export const TOO_MANY_PINS = 'Em thử sai nhiều quá, chờ 1 phút rồi thử lại nhé';

@QueryHandler(ListLiveMatchesQuery)
export class ListLiveMatchesHandler implements IQueryHandler<ListLiveMatchesQuery> {
  constructor(
    @InjectModel(LiveMatch.name)
    private readonly matchModel: Model<LiveMatch>,
  ) {}

  async execute({
    user,
    classId,
  }: ListLiveMatchesQuery): Promise<LiveMatchSummary[]> {
    const where: QueryFilter<LiveMatch> = {
      hostId: new Types.ObjectId(user.userId),
    };
    if (classId) where.classId = new Types.ObjectId(classId);
    const rows = await this.matchModel
      .find(where)
      .sort({ endedAt: -1 })
      .limit(100)
      .lean();
    return rows.map(toMatchSummary);
  }
}

@QueryHandler(GetLiveReportQuery)
export class GetLiveReportHandler implements IQueryHandler<GetLiveReportQuery> {
  constructor(
    @InjectModel(LiveMatch.name)
    private readonly matchModel: Model<LiveMatch>,
    private readonly registry: LiveRoomRegistry,
  ) {}

  async execute({
    matchId,
    user,
  }: GetLiveReportQuery): Promise<LiveMatchReport> {
    if (!Types.ObjectId.isValid(matchId)) {
      throw new NotFoundException(MATCH_NOT_FOUND);
    }
    // Opened right after the podium: wait for the report being written.
    await this.registry.findByMatch(matchId)?.meta.saving;
    const match = await this.matchModel.findById(matchId).lean();
    const allowed =
      match &&
      (user.role === Role.ADMIN || match.hostId.toString() === user.userId);
    if (!allowed) throw new NotFoundException(MATCH_NOT_FOUND);
    return toMatchReport(match);
  }
}

@QueryHandler(CheckLivePinQuery)
export class CheckLivePinHandler implements IQueryHandler<CheckLivePinQuery> {
  constructor(private readonly access: LiveAccessService) {}

  execute({ pin, key }: CheckLivePinQuery): Promise<LivePinInfo> {
    const room = this.access.findRoom(pin, key);
    if (room === 'blocked') {
      throw new HttpException(TOO_MANY_PINS, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!room) throw new NotFoundException(PIN_NOT_FOUND);
    return Promise.resolve({
      quizTitle: room.meta.quiz.title,
      coverEmoji: room.meta.quiz.coverEmoji,
      className: room.meta.className,
      allowGuests: room.meta.allowGuests,
      started: room.state.phase !== 'lobby',
    });
  }
}
