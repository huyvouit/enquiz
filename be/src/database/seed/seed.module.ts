import { Module } from '@nestjs/common';
import { QuestionsModule } from '../../modules/questions/questions.module.js';
import { QuizzesModule } from '../../modules/quizzes/quizzes.module.js';
import { UsersModule } from '../../modules/users/users.module.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [UsersModule, QuestionsModule, QuizzesModule],
  providers: [SeedService],
})
export class SeedModule {}
