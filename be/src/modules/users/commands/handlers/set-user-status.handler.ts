import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccountStatus } from '../../../../common/enums/account-status.enum.js';
import { Role } from '../../../../common/enums/role.enum.js';
import { AccountStatusService } from '../../account-status.service.js';
import { AuthSessionService } from '../../sessions/auth-session.service.js';
import { User } from '../../schemas/user.schema.js';
import { PublicUser, toPublicUser } from '../../users.mapper.js';
import { SetUserStatusCommand } from '../impl/user-admin.commands.js';

@CommandHandler(SetUserStatusCommand)
export class SetUserStatusHandler implements ICommandHandler<SetUserStatusCommand> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly statuses: AccountStatusService,
    private readonly sessions: AuthSessionService,
  ) {}

  async execute({
    targetId,
    status,
    actor,
  }: SetUserStatusCommand): Promise<PublicUser> {
    if (targetId === actor.userId) {
      throw new BadRequestException('Không thể đổi trạng thái của chính mình');
    }
    const target = await this.userModel.findById(targetId, { role: 1 }).lean();
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');
    if (target.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Không thể đổi trạng thái của quản trị viên',
      );
    }

    const updated = await this.userModel
      .findByIdAndUpdate(targetId, { status }, { returnDocument: 'after' })
      .lean();
    this.statuses.invalidate(targetId);
    // A disabled account loses its sessions: unlocking it needs a new login.
    if (status === AccountStatus.DISABLED) {
      await this.sessions.revokeAll(targetId);
    }
    return toPublicUser(updated!);
  }
}
