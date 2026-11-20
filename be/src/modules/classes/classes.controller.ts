import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ResetPasswordCommand } from '../users/commands/impl/user-admin.commands.js';
import {
  BulkCreateStudentsCommand,
  CreateClassCommand,
  DeleteGroupCommand,
  JoinClassCommand,
  RegenerateClassCodeCommand,
  RemoveStudentCommand,
  SaveGroupCommand,
  UpdateClassCommand,
} from './commands/impl/class.commands.js';
import {
  BulkStudentsDto,
  CreateClassDto,
  GroupDto,
  JoinClassDto,
  UpdateClassDto,
} from './dto/class.dto.js';
import {
  GetClassDetailQuery,
  ListMyClassesQuery,
} from './queries/impl/class-views.queries.js';

const MANAGERS = [Role.TEACHER, Role.ADMIN];

@Controller('classes')
export class ClassesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** Teacher: classes I teach. Student: classes I am in. Admin: all. */
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('archived', new ParseBoolPipe({ optional: true }))
    archived?: boolean,
  ) {
    return this.queryBus.execute(
      new ListMyClassesQuery(user, archived ?? false),
    );
  }

  @Roles(...MANAGERS)
  @Post()
  create(@Body() dto: CreateClassDto, @CurrentUser() user: AuthUser) {
    return this.commandBus.execute(new CreateClassCommand(dto, user));
  }

  @Roles(Role.STUDENT)
  @Post('join')
  @HttpCode(HttpStatus.OK)
  join(@Body() dto: JoinClassDto, @CurrentUser() user: AuthUser) {
    return this.commandBus.execute(new JoinClassCommand(dto.code, user));
  }

  @Roles(...MANAGERS)
  @Get(':id')
  detail(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new GetClassDetailQuery(id, user));
  }

  @Roles(...MANAGERS)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new UpdateClassCommand(id, dto, user));
  }

  @Roles(...MANAGERS)
  @Post(':id/code')
  @HttpCode(HttpStatus.OK)
  regenerateCode(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new RegenerateClassCodeCommand(id, user));
  }

  // ---------- Students ----------

  /** Creates accounts; the response is the only place the passwords appear. */
  @Roles(...MANAGERS)
  @Post(':id/students/bulk')
  bulkCreate(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: BulkStudentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(
      new BulkCreateStudentsCommand(id, dto.fullNames, user),
    );
  }

  @Roles(...MANAGERS)
  @Delete(':id/students/:studentId')
  removeStudent(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('studentId', ParseObjectIdPipe) studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(
      new RemoveStudentCommand(id, studentId, user),
    );
  }

  /** The handler checks the teacher has this student in one of their classes. */
  @Roles(...MANAGERS)
  @Post(':id/students/:studentId/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Param('studentId', ParseObjectIdPipe) studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new ResetPasswordCommand(studentId, user));
  }

  // ---------- Groups ----------

  @Roles(...MANAGERS)
  @Post(':id/groups')
  createGroup(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: GroupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new SaveGroupCommand(id, null, dto, user));
  }

  @Roles(...MANAGERS)
  @Put(':id/groups/:groupId')
  updateGroup(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('groupId', ParseObjectIdPipe) groupId: string,
    @Body() dto: GroupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(
      new SaveGroupCommand(id, groupId, dto, user),
    );
  }

  @Roles(...MANAGERS)
  @Delete(':id/groups/:groupId')
  deleteGroup(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('groupId', ParseObjectIdPipe) groupId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new DeleteGroupCommand(id, groupId, user));
  }
}
