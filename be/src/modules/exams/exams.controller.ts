import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  SaveExamDraftCommand,
  StartExamCommand,
  SubmitExamCommand,
} from './commands/impl/exam.commands.js';
import { ExamAnswersDto, StartExamDto, SubmitExamDto } from './dto/exam.dto.js';
import {
  GetExamIntroQuery,
  GetExamQuery,
} from './queries/impl/exam.queries.js';

/** Exam mode (plan 4.2, doc 14). Students only; teachers read results
 * through the homework and analytics endpoints. */
@Roles(Role.STUDENT)
@Controller('exams')
export class ExamsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** Start screen: time, question count, whether already started. */
  @Get('assignments/:assignmentId')
  intro(
    @Param('assignmentId', ParseObjectIdPipe) assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new GetExamIntroQuery(assignmentId, user));
  }

  /** Starts the timer, or continues the session in progress. */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  start(@Body() dto: StartExamDto, @CurrentUser() user: AuthUser) {
    return this.commandBus.execute(
      new StartExamCommand(dto.assignmentId, user),
    );
  }

  /** In progress → the session; handed in → the result. */
  @Get(':id')
  get(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new GetExamQuery(id, user));
  }

  /** Draft save (plan E2). */
  @Patch(':id/answers')
  saveDraft(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ExamAnswersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new SaveExamDraftCommand(id, dto, user));
  }

  /** Grades once and returns the result. */
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SubmitExamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new SubmitExamCommand(id, dto, user));
  }
}
