import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassesModule } from '../classes/classes.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { QuestionsModule } from '../questions/questions.module.js';
import { QuizzesModule } from '../quizzes/quizzes.module.js';
import { UsersModule } from '../users/users.module.js';
import { CreateLiveMatchHandler } from './commands/handlers/create-live-match.handler.js';
import { LiveAccessService } from './live-access.service.js';
import { LiveAuthService } from './live-auth.js';
import { LiveResultsService } from './live-results.service.js';
import { LiveRoomRegistry } from './live-room.registry.js';
import { LiveController } from './live.controller.js';
import { LiveGateway } from './live.gateway.js';
import {
  CheckLivePinHandler,
  GetLiveReportHandler,
  ListLiveMatchesHandler,
} from './queries/handlers/live-query.handlers.js';
import { LiveMatch, LiveMatchSchema } from './schemas/live-match.schema.js';

/**
 * Live quiz arena (plan 5, doc 15): Socket.io namespace `/live`, rooms in
 * memory, reports in live_matches. Depends on quizzes, questions, progress
 * and classes (ClassAccessQuery); nothing depends on it.
 */
@Module({
  imports: [
    CqrsModule,
    UsersModule,
    ClassesModule,
    QuestionsModule,
    QuizzesModule,
    ProgressModule,
    MongooseModule.forFeature([
      { name: LiveMatch.name, schema: LiveMatchSchema },
    ]),
    // Same secret as AuthModule; only used to verify handshake tokens.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [LiveController],
  providers: [
    LiveAuthService,
    LiveRoomRegistry,
    LiveAccessService,
    LiveResultsService,
    LiveGateway,
    CreateLiveMatchHandler,
    ListLiveMatchesHandler,
    GetLiveReportHandler,
    CheckLivePinHandler,
  ],
})
export class LiveModule {}
