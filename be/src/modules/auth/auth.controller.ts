import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { LoginCommand } from './commands/impl/login.command.js';
import { RegisterCommand } from './commands/impl/register.command.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

/** Rate limited per username and per IP against password guessing (see auth-throttle.ts). */
@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  /** POST /api/v1/auth/register — student or teacher self sign-up. */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.commandBus.execute(new RegisterCommand(dto));
  }

  /** POST /api/v1/auth/login — returns { accessToken, user }. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.commandBus.execute(
      new LoginCommand(dto.username, dto.password),
    );
  }
}
