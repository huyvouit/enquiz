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
  StreamableFile,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CSV_TEMPLATE,
  ImportQuestionsCommand,
  ImportQuestionsDto,
} from './import/import-questions.command.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { BackfillAudioCommand, GetAudioStatusQuery } from './audio-backfill.js';
import { CreateQuestionCommand } from './commands/impl/create-question.command.js';
import { DeleteQuestionCommand } from './commands/impl/delete-question.command.js';
import { UpdateQuestionCommand } from './commands/impl/update-question.command.js';
import { ListQuestionsDto } from './dto/list-questions.dto.js';
import { QuestionDto } from './dto/question.dto.js';
import { GetQuestionQuery } from './queries/impl/get-question.query.js';
import { ListQuestionsQuery } from './queries/impl/list-questions.query.js';
import { ListTopicsQuery } from './queries/impl/list-topics.query.js';

/** The question bank contains answer keys, so it is never exposed to students. */
@Roles(Role.TEACHER, Role.ADMIN)
@Controller('questions')
export class QuestionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  list(@Query() filters: ListQuestionsDto, @CurrentUser() user: AuthUser) {
    return this.queryBus.execute(new ListQuestionsQuery(filters, user));
  }

  /** CSV template with one example per question type. */
  @Get('import/template')
  importTemplate() {
    return new StreamableFile(Buffer.from(CSV_TEMPLATE, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="mau-cau-hoi-enquiz.csv"',
    });
  }

  /**
   * POST /questions/import?dryRun=true|false — body { csv }.
   * Each row goes through the same rules as the form; errors are per row.
   */
  /** GET /questions/audio/status — listening questions still without audio (plan D16). */
  @Roles(Role.ADMIN)
  @Get('audio/status')
  audioStatus() {
    return this.queryBus.execute(new GetAudioStatusQuery());
  }

  /** POST /questions/audio/backfill — makes the missing audio, one batch per call. */
  @Roles(Role.ADMIN)
  @Post('audio/backfill')
  @HttpCode(HttpStatus.OK)
  backfillAudio() {
    return this.commandBus.execute(new BackfillAudioCommand());
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  importCsv(
    @Body() dto: ImportQuestionsDto,
    @Query('dryRun', new ParseBoolPipe({ optional: true }))
    dryRun: boolean | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(
      new ImportQuestionsCommand(dto.csv, dryRun ?? true, user),
    );
  }

  @Get('topics')
  topics() {
    return this.queryBus.execute(new ListTopicsQuery());
  }

  @Get(':id')
  get(@Param('id', ParseObjectIdPipe) id: string) {
    return this.queryBus.execute(new GetQuestionQuery(id));
  }

  @Post()
  create(@Body() dto: QuestionDto, @CurrentUser() user: AuthUser) {
    return this.commandBus.execute(new CreateQuestionCommand(dto, user));
  }

  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: QuestionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new UpdateQuestionCommand(id, dto, user));
  }

  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commandBus.execute(new DeleteQuestionCommand(id, user));
  }
}
