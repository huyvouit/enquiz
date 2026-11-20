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
import { UsersController } from './users.controller.js';

@Module({
  imports: [
    CqrsModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [
    AccountStatusService,
    ActiveAccountGuard,
    GetProfileHandler,
    ListUsersHandler,
    SetUserStatusHandler,
    ResetPasswordHandler,
  ],
  // Other modules read the User model; AppModule registers the guard globally.
  exports: [MongooseModule, AccountStatusService, ActiveAccountGuard],
})
export class UsersModule {}
