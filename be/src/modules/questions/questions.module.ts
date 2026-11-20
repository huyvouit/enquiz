import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { CreateQuestionHandler } from './commands/handlers/create-question.handler.js';
import { DeleteQuestionHandler } from './commands/handlers/delete-question.handler.js';
import { UpdateQuestionHandler } from './commands/handlers/update-question.handler.js';
import { GetQuestionHandler } from './queries/handlers/get-question.handler.js';
import { ListQuestionsHandler } from './queries/handlers/list-questions.handler.js';
import { ListTopicsHandler } from './queries/handlers/list-topics.handler.js';
import { ImportQuestionsHandler } from './import/import-questions.command.js';
import { QuestionImportService } from './import/question-import.service.js';
import { QuestionsController } from './questions.controller.js';
import { Question, QuestionSchema } from './schemas/question.schema.js';

@Module({
  imports: [
    CqrsModule,
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
    ]),
  ],
  controllers: [QuestionsController],
  providers: [
    CreateQuestionHandler,
    UpdateQuestionHandler,
    DeleteQuestionHandler,
    ListQuestionsHandler,
    GetQuestionHandler,
    ListTopicsHandler,
    QuestionImportService,
    ImportQuestionsHandler,
  ],
  // Quizzes (validate ids, play view) and Progress (grading) read questions.
  // seed:content reuses the importer.
  exports: [MongooseModule, QuestionImportService],
})
export class QuestionsModule {}
