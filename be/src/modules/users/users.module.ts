import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountStatusService } from './account-status.service.js';
import { AdminUsersController } from './admin-users.controller.js';
import { ResetPasswordHandler } from './commands/handlers/reset-password.handler.js';
import { SetUserStatusHandler } from './commands/handlers/set-user-status.handler.js';
import { ActiveAccountGuard } from './guards/active-account.guard.js';
import { GetProfileHandler } from './queries/handlers/get-profile.handler.js';
import { ListUsersHandler } from './queries/handlers/list-users.handler.js';
import { User, UserSchema } from './schemas/user.schema.js';
import {
  AuthSession,
  AuthSessionSchema,
} from './sessions/auth-session.schema.js';
import { AuthSessionService } from './sessions/auth-session.service.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [
    CqrsModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AuthSession.name, schema: AuthSessionSchema },
    ]),
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [
    AccountStatusService,
    AuthSessionService,
    ActiveAccountGuard,
    GetProfileHandler,
    ListUsersHandler,
    SetUserStatusHandler,
    ResetPasswordHandler,
  ],
  // Other modules read the User model; AppModule registers the guard globally.
  exports: [
    MongooseModule,
    AccountStatusService,
    AuthSessionService,
    ActiveAccountGuard,
  ],
})
export class UsersModule {}
