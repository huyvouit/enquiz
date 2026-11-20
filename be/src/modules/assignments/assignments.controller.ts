import {
  Body,
  Controller,
  Delete,
  Get,
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
  CreateAssignmentCommand,
  DeleteAssignmentCommand,
  UpdateAssignmentCommand,
} from './commands/impl/assignment.commands.js';
import {
  CreateAssignmentDto,
  ListAssignmentsDto,
  UpdateAssignmentDto,
} from './dto/assignment.dto.js';
import {
  GetAssignmentDetailQuery,
  ListClassAssignmentsQuery,
  MyAssignmentsQuery,
  MyRemindersQuery,
} from './queries/impl/assignment.queries.js';

const MANAGERS = [Role.TEACHER, Role.ADMIN];

@Controller()
export class AssignmentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ---------- Teacher ----------

  @Roles(...MANAGERS)
  @Post('classes/:classId/assignments')
  create(
    @Param('classId', ParseObjectIdPipe) classId: string,
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(
      new CreateAssignmentCommand(classId, dto, user),
    );
  }

  @Roles(...MANAGERS)
  @Get('classes/:classId/assignments')
  listForClass(
    @Param('classId', ParseObjectIdPipe) classId: string,
    @Query() q: ListAssignmentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(
      new ListClassAssignmentsQuery(classId, q.status, user),
    );
  }

  // ---------- Student (declared before :id so "mine" is not an id) ----------

  @Roles(Role.STUDENT)
  @Get('assignments/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.queryBus.execute(new MyAssignmentsQuery(user));
  }

  /** Small payload polled by the home page banner and header badge. */
  @Roles(Role.STUDENT)
  @Get('assignments/mine/reminders')
  reminders(@CurrentUser() user: AuthUser) {
    return this.queryBus.execute(new MyRemindersQuery(user));
  }

  // ---------- One assignment (teacher) ----------

  @Roles(...MANAGERS)
  @Get('assignments/:id')
  detail(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new GetAssignmentDetailQuery(id, user));
  }

  @Roles(...MANAGERS)
  @Patch('assignments/:id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new UpdateAssignmentCommand(id, dto, user));
  }

  @Roles(...MANAGERS)
  @Delete('assignments/:id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new DeleteAssignmentCommand(id, user));
  }
}
