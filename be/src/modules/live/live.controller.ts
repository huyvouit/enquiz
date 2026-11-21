import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { RateLimit } from '../../common/rate-limit/rate-limit.js';
import { CreateLiveMatchCommand } from './commands/impl/live.commands.js';
import {
  CreateLiveMatchDto,
  ListLiveMatchesDto,
  PinParamDto,
} from './dto/live.dto.js';
import {
  CheckLivePinQuery,
  GetLiveReportQuery,
  ListLiveMatchesQuery,
} from './queries/impl/live.queries.js';

/**
 * Live quiz REST side (plan 5, doc 15): opening a room and the reports.
 * Everything during the match goes over the `/live` socket.
 */
@Controller('live')
export class LiveController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Roles(Role.TEACHER, Role.ADMIN)
  @RateLimit('live-create', 10)
  @Post('matches')
  create(@Body() dto: CreateLiveMatchDto, @CurrentUser() user: AuthUser) {
    return this.commandBus.execute(new CreateLiveMatchCommand(dto, user));
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Get('matches')
  list(@Query() dto: ListLiveMatchesDto, @CurrentUser() user: AuthUser) {
    return this.queryBus.execute(new ListLiveMatchesQuery(user, dto.classId));
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Get('matches/:id')
  report(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new GetLiveReportQuery(id, user));
  }

  /**
   * Join screen check, before connecting. Public: guests have no account.
   * Wrong PINs are limited per IP (L4); `req.ip` follows TRUST_PROXY.
   */
  @Public()
  @Get('pin/:pin')
  checkPin(@Param() { pin }: PinParamDto, @Req() req: Request) {
    return this.queryBus.execute(new CheckLivePinQuery(pin, `ip:${req.ip}`));
  }
}
