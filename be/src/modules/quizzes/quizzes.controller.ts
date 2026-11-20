import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { CreateQuizCommand } from './commands/impl/create-quiz.command.js';
import { DeleteQuizCommand } from './commands/impl/delete-quiz.command.js';
import { UpdateQuizCommand } from './commands/impl/update-quiz.command.js';
import { ListQuizzesDto } from './dto/list-quizzes.dto.js';
import {
  GradeLevelQueryDto,
  MapOrderQuery,
  ReorderMapCommand,
  ReorderMapDto,
} from './map-order.js';
import { QuizDto } from './dto/quiz.dto.js';
import { GetPlayQuizQuery } from './queries/impl/get-play-quiz.query.js';
import { GetQuizDetailQuery } from './queries/impl/get-quiz-detail.query.js';
import { ListQuizzesQuery } from './queries/impl/list-quizzes.query.js';

@Controller('quizzes')
export class QuizzesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** Any role. Results are filtered by visibility rules (see quiz-access.ts). */
  @Get()
  list(@Query() filters: ListQuizzesDto, @CurrentUser() user: AuthUser) {
    return this.queryBus.execute(new ListQuizzesQuery(filters, user));
  }

  /** Admin: system quizzes of a grade in quest-map order (declared before :id). */
  @Roles(Role.ADMIN)
  @Get('map-order')
  mapOrder(@Query() q: GradeLevelQueryDto) {
    return this.queryBus.execute(new MapOrderQuery(q.gradeLevel));
  }

  @Roles(Role.ADMIN)
  @Put('map-order')
  reorderMap(@Body() dto: ReorderMapDto) {
    return this.commandBus.execute(
      new ReorderMapCommand(dto.gradeLevel, dto.quizIds),
    );
  }

  /** Any role. Game payload without answer keys. */
  @Get(':id/play')
  play(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new GetPlayQuizQuery(id, user));
  }

  /** Full quiz with answer keys. */
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get(':id')
  detail(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new GetQuizDetailQuery(id, user));
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  create(@Body() dto: QuizDto, @CurrentUser() user: AuthUser) {
    return this.commandBus.execute(new CreateQuizCommand(dto, user));
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: QuizDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new UpdateQuizCommand(id, dto, user));
  }

  @Roles(Role.TEACHER, Role.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new DeleteQuizCommand(id, user));
  }
}
