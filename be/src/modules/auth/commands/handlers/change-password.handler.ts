import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  clientPasswordHash,
  hashForStorage,
  passwordMatches,
} from '../../../../common/utils/passwords.js';
import {
  AccountStatusService,
  passwordChangeStamp,
} from '../../../users/account-status.service.js';
import { AuthSessionService } from '../../../users/sessions/auth-session.service.js';
import { User } from '../../../users/schemas/user.schema.js';
import { toPublicUser } from '../../../users/users.mapper.js';
import { AuthResult } from '../../auth.types.js';
import { TokenService } from '../../token.service.js';
import { ChangePasswordCommand } from '../impl/change-password.command.js';

/**
 * Both passwords arrive as client hashes, so the length rules (6, admins 12;
 * plan D20) are checked in the browser. The server still refuses the
 * username itself and the current password.
 */

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly tokenService: TokenService,
    private readonly statuses: AccountStatusService,
    private readonly sessions: AuthSessionService,
  ) {}

  async execute({
    user,
    currentPassword,
    newPassword,
  }: ChangePasswordCommand): Promise<AuthResult> {
    const account = await this.userModel
      .findById(user.userId)
      .select('+password')
      .lean();
    if (!account) {
      throw new UnauthorizedException('Tài khoản không còn tồn tại');
    }

    // 400, not 401: the app treats 401 as "session over" and logs out.
    if (!(await passwordMatches(currentPassword, account.password))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (
      newPassword === clientPasswordHash(account.username, account.username)
    ) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng tên đăng nhập',
      );
    }
    if (await passwordMatches(newPassword, account.password)) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    // Tokens issued before this second stop working on other devices.
    await this.userModel.updateOne(
      { _id: account._id },
      {
        password: await hashForStorage(newPassword),
        passwordChangedAt: passwordChangeStamp(),
      },
    );
    this.statuses.invalidate(user.userId);
    // Other devices lose their sessions (D22); this one keeps its own, and
    // its new access token is signed after the stamp.
    await this.sessions.revokeAll(user.userId, user.sessionId);
    return this.tokenService.issue(toPublicUser(account), user.sessionId!);
  }
}
