import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { ChangePasswordHandler } from './commands/handlers/change-password.handler.js';
import { LoginHandler } from './commands/handlers/login.handler.js';
import { RegisterHandler } from './commands/handlers/register.handler.js';
import { PasswordController } from './password.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    CqrsModule,
    PassportModule,
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // e.g. "7d", "12h" — validated in env.validation.ts
          expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN') as never,
        },
      }),
    }),
  ],
  controllers: [AuthController, PasswordController],
  providers: [
    TokenService,
    JwtStrategy,
    RegisterHandler,
    LoginHandler,
    ChangePasswordHandler,
  ],
})
export class AuthModule {}
