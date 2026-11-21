import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { Role } from '../../../../common/enums/role.enum.js';
import {
  BCRYPT_ROUNDS,
  kidPassword,
} from '../../../../common/utils/passwords.js';
import { TeachesStudentQuery } from '../../../classes/queries/impl/class-membership.queries.js';
import {
  AccountStatusService,
  passwordChangeStamp,
} from '../../account-status.service.js';
import { User } from '../../schemas/user.schema.js';
import {
  ResetPasswordCommand,
  TemporaryPassword,
} from '../impl/user-admin.commands.js';

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly queryBus: QueryBus,
    private readonly statuses: AccountStatusService,
  ) {}

  async execute({
    targetId,
    actor,
  }: ResetPasswordCommand): Promise<TemporaryPassword> {
    const target = await this.userModel.findById(targetId).lean();
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');

    if (actor.role === Role.ADMIN) {
      if (target.role === Role.ADMIN) {
        throw new ForbiddenException(
          'Không thể đặt lại mật khẩu của quản trị viên',
        );
      }
    } else {
      // Teachers: students of their own classes only; anyone else "does not exist".
      const teaches =
        target.role === Role.STUDENT &&
        (await this.queryBus.execute(
          new TeachesStudentQuery(actor.userId, targetId),
        ));
      if (!teaches) throw new NotFoundException('Không tìm thấy học sinh');
    }

    const temporaryPassword = kidPassword();
    // The old password may be known to someone else: end its sessions (D20).
    await this.userModel.updateOne(
      { _id: target._id },
      {
        password: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS),
        passwordChangedAt: passwordChangeStamp(),
      },
    );
    this.statuses.invalidate(target._id.toString());
    return {
      userId: target._id.toString(),
      username: target.username,
      fullName: target.fullName,
      temporaryPassword,
    };
  }
}
