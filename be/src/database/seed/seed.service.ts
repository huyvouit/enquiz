import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { hashPlainForStorage } from '../../common/utils/passwords.js';
import { Question } from '../../modules/questions/schemas/question.schema.js';
import { Quiz, QuizStatus } from '../../modules/quizzes/schemas/quiz.schema.js';
import { User } from '../../modules/users/schemas/user.schema.js';
import { DEMO_QUIZZES, DEMO_USERS } from './demo-data.js';

/**
 * When SEED_DEMO_DATA=true and the database has no users yet, inserts demo
 * accounts plus system questions/quizzes. Never touches a non-empty database.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.get<boolean>('SEED_DEMO_DATA')) return;
    if ((await this.userModel.estimatedDocumentCount()) > 0) return;
    await this.seed();
  }

  async seed() {
    for (const u of DEMO_USERS) {
      await this.userModel.create({
        username: u.username,
        password: await hashPlainForStorage(u.username, u.password),
        fullName: u.fullName,
        role: u.role,
        studentProfile:
          'gradeLevel' in u ? { gradeLevel: u.gradeLevel } : undefined,
      });
    }

    let questionCount = 0;
    for (const quiz of DEMO_QUIZZES) {
      const questions = await this.questionModel.insertMany(
        quiz.questions.map((q) => ({
          ...q,
          topic: quiz.topic,
          gradeLevel: quiz.gradeLevel,
          createdBy: null,
        })),
      );
      questionCount += questions.length;
      await this.quizModel.create({
        title: quiz.title,
        description: quiz.description,
        topic: quiz.topic,
        gradeLevel: quiz.gradeLevel,
        coverEmoji: quiz.coverEmoji,
        questionIds: questions.map((q) => q._id),
        status: QuizStatus.PUBLISHED,
        createdBy: null,
      });
    }

    this.logger.log(
      `Seeded ${DEMO_USERS.length} users, ${questionCount} questions, ${DEMO_QUIZZES.length} quizzes. ` +
        `Logins: ${DEMO_USERS.map((u) => `${u.username}/${u.password}`).join(', ')}`,
    );
  }
}
