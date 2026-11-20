import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  AnswerQuestionCommand,
  FinishQuizSessionCommand,
  StartQuizSessionCommand,
} from './commands/impl/session.commands.js';
import {
  LeaderboardQueryDto,
  MapQueryDto,
} from './dto/progress-queries.dto.js';
import { AnswerQuestionDto, StartSessionDto } from './dto/session.dto.js';
import { GetAttemptQuery } from './queries/impl/get-attempt.query.js';
import { GetMyHistoryQuery } from './queries/impl/get-my-history.query.js';
import { GetQuizResultsQuery } from './queries/impl/get-quiz-results.query.js';
import {
  GetLeaderboardQuery,
  GetQuestMapQuery,
} from './queries/impl/progression.queries.js';

@Controller('progress')
export class ProgressController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ---------- Playing (student) ----------

  /** Opens or resumes a play session; returns answers already given. */
  @Roles(Role.STUDENT)
  @Post('sessions')
  @HttpCode(HttpStatus.OK)
  startSession(@Body() dto: StartSessionDto, @CurrentUser() user: AuthUser) {
    return this.commandBus.execute(
      new StartQuizSessionCommand(dto.quizId, user, dto.assignmentId ?? null),
    );
  }

  /** Grades one answer right away (instant feedback). First answer is final. */
  @Roles(Role.STUDENT)
  @Post('sessions/:id/answers')
  @HttpCode(HttpStatus.OK)
  answer(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AnswerQuestionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(
      new AnswerQuestionCommand(id, dto.questionId, dto.studentAnswer, user),
    );
  }

  /** Saves the attempt, updates level/XP, returns the full result. */
  @Roles(Role.STUDENT)
  @Post('sessions/:id/finish')
  finish(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new FinishQuizSessionCommand(id, user));
  }

  // ---------- Progression ----------

  @Roles(Role.STUDENT)
  @Get('map')
  map(@Query() q: MapQueryDto, @CurrentUser() user: AuthUser) {
    return this.queryBus.execute(new GetQuestMapQuery(user, q.gradeLevel));
  }

  /**
   * Any role. scope=grade (default): the student's grade, short names.
   * scope=class: members of one class, full names (members/teacher only).
   */
  @Get('leaderboard')
  leaderboard(@Query() q: LeaderboardQueryDto, @CurrentUser() user: AuthUser) {
    return this.queryBus.execute(
      new GetLeaderboardQuery(user, q.period, q.gradeLevel, q.scope, q.classId),
    );
  }

  // ---------- History & reports ----------

  @Roles(Role.STUDENT)
  @Get('history')
  history(@CurrentUser() user: AuthUser) {
    return this.queryBus.execute(new GetMyHistoryQuery(user.userId));
  }

  /** One attempt with per-question review. Access checked in the handler. */
  @Get('attempts/:id')
  attempt(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new GetAttemptQuery(id, user));
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Get('quiz/:quizId')
  quizResults(
    @Param('quizId', ParseObjectIdPipe) quizId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new GetQuizResultsQuery(quizId, user));
  }
}
