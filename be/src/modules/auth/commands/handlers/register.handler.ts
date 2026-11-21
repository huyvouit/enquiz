import { ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccountStatus } from '../../../../common/enums/account-status.enum.js';
import { Role } from '../../../../common/enums/role.enum.js';
import { hashForStorage } from '../../../../common/utils/passwords.js';
import { User } from '../../../users/schemas/user.schema.js';
import { toPublicUser } from '../../../users/users.mapper.js';
import { SessionResult } from '../../auth.types.js';
import { TokenService } from '../../token.service.js';
import { RegisterCommand } from '../impl/register.command.js';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly tokenService: TokenService,
  ) {}

  async execute({ dto, session }: RegisterCommand): Promise<SessionResult> {
    const username = dto.username.toLowerCase().trim();
    if (await this.userModel.exists({ username })) {
      throw new ConflictException('Tên đăng nhập đã được sử dụng');
    }

    const created = await this.userModel.create({
      username,
      password: await hashForStorage(dto.password),
      fullName: dto.fullName.trim(),
      role: dto.role,
      // Teachers will see children's data: an admin must approve them first.
      status:
        dto.role === Role.TEACHER
          ? AccountStatus.PENDING
          : AccountStatus.ACTIVE,
      studentProfile:
        dto.role === Role.STUDENT ? { gradeLevel: dto.gradeLevel } : undefined,
    });

    return this.tokenService.startSession(
      toPublicUser(created.toObject()),
      session,
    );
  }
}
