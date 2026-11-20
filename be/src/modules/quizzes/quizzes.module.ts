import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { QuestionsModule } from '../questions/questions.module.js';
import { UsersModule } from '../users/users.module.js';
import { CreateQuizHandler } from './commands/handlers/create-quiz.handler.js';
import { DeleteQuizHandler } from './commands/handlers/delete-quiz.handler.js';
import { UpdateQuizHandler } from './commands/handlers/update-quiz.handler.js';
import { CountQuizzesUsingQuestionHandler } from './queries/handlers/count-quizzes-using-question.handler.js';
import { GetPlayQuizHandler } from './queries/handlers/get-play-quiz.handler.js';
import { GetQuizDetailHandler } from './queries/handlers/get-quiz-detail.handler.js';
import { ListQuizzesHandler } from './queries/handlers/list-quizzes.handler.js';
import { MapOrderHandler, ReorderMapHandler } from './map-order.js';
import { QuizAuthorsService } from './quiz-authors.service.js';
import { QuizQuestionsValidator } from './quiz-questions.validator.js';
import { QuizzesController } from './quizzes.controller.js';
import { Quiz, QuizSchema } from './schemas/quiz.schema.js';

@Module({
  imports: [
    CqrsModule,
    UsersModule,
    QuestionsModule,
    MongooseModule.forFeature([{ name: Quiz.name, schema: QuizSchema }]),
  ],
  controllers: [QuizzesController],
  providers: [
    QuizAuthorsService,
    QuizQuestionsValidator,
    CreateQuizHandler,
    UpdateQuizHandler,
    DeleteQuizHandler,
    ListQuizzesHandler,
    GetQuizDetailHandler,
    GetPlayQuizHandler,
    CountQuizzesUsingQuestionHandler,
    MapOrderHandler,
    ReorderMapHandler,
  ],
  // Progress reads quizzes when grading a submission.
  exports: [MongooseModule],
})
export class QuizzesModule {}
