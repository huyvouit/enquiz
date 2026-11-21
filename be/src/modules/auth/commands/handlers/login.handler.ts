import { UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccountStatus } from '../../../../common/enums/account-status.enum.js';
import { passwordMatches } from '../../../../common/utils/passwords.js';
import { User } from '../../../users/schemas/user.schema.js';
import { toPublicUser } from '../../../users/users.mapper.js';
import { SessionResult } from '../../auth.types.js';
import { TokenService } from '../../token.service.js';
import { LoginCommand } from '../impl/login.command.js';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly tokenService: TokenService,
  ) {}

  async execute({
    username,
    password,
    session,
  }: LoginCommand): Promise<SessionResult> {
    const user = await this.userModel
      .findOne({ username: username.toLowerCase().trim() })
      .select('+password')
      .lean();

    // Same message for unknown user and wrong password: do not leak which one.
    // `password` is the client hash (CLIENT_HASH, checked by LoginDto).
    const valid = user && (await passwordMatches(password, user.password));
    if (!user || !valid) {
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }

    if (user.status === AccountStatus.DISABLED) {
      throw new UnauthorizedException(
        'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên',
      );
    }

    return this.tokenService.startSession(toPublicUser(user), session);
  }
}
