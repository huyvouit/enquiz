import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
  ResetPasswordCommand,
  SetUserStatusCommand,
} from './commands/impl/user-admin.commands.js';
import { ListUsersDto, SetUserStatusDto } from './dto/admin-users.dto.js';
import { ListUsersQuery } from './queries/impl/list-users.query.js';

@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  list(@Query() filters: ListUsersDto) {
    return this.queryBus.execute(new ListUsersQuery(filters));
  }

  /** Approve a pending teacher (status=active) or lock an account (disabled). */
  @Patch(':id/status')
  setStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.commandBus.execute(
      new SetUserStatusCommand(id, dto.status, actor),
    );
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.commandBus.execute(new ResetPasswordCommand(id, actor));
  }
}
