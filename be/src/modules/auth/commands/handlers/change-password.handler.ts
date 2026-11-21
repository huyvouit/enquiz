import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { Role } from '../../../../common/enums/role.enum.js';
import { BCRYPT_ROUNDS } from '../../../../common/utils/passwords.js';
import {
  AccountStatusService,
  passwordChangeStamp,
} from '../../../users/account-status.service.js';
import { User } from '../../../users/schemas/user.schema.js';
import { toPublicUser } from '../../../users/users.mapper.js';
import { AuthResult } from '../../auth.types.js';
import { TokenService } from '../../token.service.js';
import { ChangePasswordCommand } from '../impl/change-password.command.js';

/** Same minimum as sign-up; admins as `create:admin` (plan D20). */
export const MIN_PASSWORD = 6;
export const MIN_ADMIN_PASSWORD = 12;

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly tokenService: TokenService,
    private readonly statuses: AccountStatusService,
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
    if (!(await bcrypt.compare(currentPassword, account.password))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    const min = account.role === Role.ADMIN ? MIN_ADMIN_PASSWORD : MIN_PASSWORD;
    if (newPassword.length < min) {
      throw new BadRequestException(`Mật khẩu mới cần ít nhất ${min} ký tự`);
    }
    if (newPassword.toLowerCase() === account.username) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng tên đăng nhập',
      );
    }
    if (await bcrypt.compare(newPassword, account.password)) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    // Tokens issued before this second stop working on other devices.
    await this.userModel.updateOne(
      { _id: account._id },
      {
        password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
        passwordChangedAt: passwordChangeStamp(),
      },
    );
    this.statuses.invalidate(user.userId);
    // Signed after the stamp, so this device stays logged in.
    return this.tokenService.issue(toPublicUser(account));
  }
}
