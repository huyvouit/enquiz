import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { SeedModule } from './database/seed/seed.module.js';
import { HealthController } from './health.controller.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AssignmentsModule } from './modules/assignments/assignments.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ClassesModule } from './modules/classes/classes.module.js';
import { ProgressModule } from './modules/progress/progress.module.js';
import { QuestionsModule } from './modules/questions/questions.module.js';
import { QuizzesModule } from './modules/quizzes/quizzes.module.js';
import { ActiveAccountGuard } from './modules/users/guards/active-account.guard.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    CqrsModule.forRoot(),
    // Used by @UseGuards(ThrottlerGuard) on the auth endpoints only.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { ttl: 60_000, limit: config.getOrThrow<number>('AUTH_RATE_LIMIT') },
        ],
        errorMessage:
          'Bạn thử quá nhiều lần rồi. Vui lòng đợi một phút rồi thử lại nhé',
      }),
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    ClassesModule,
    QuestionsModule,
    QuizzesModule,
    ProgressModule,
    AssignmentsModule,
    AnalyticsModule,
    UploadsModule,
    SeedModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate, check the account is active, then roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: ActiveAccountGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
