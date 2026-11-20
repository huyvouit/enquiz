import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../schemas/user.schema.js';
import { PublicUser, toPublicUser } from '../../users.mapper.js';
import { GetProfileQuery } from '../impl/get-profile.query.js';

@QueryHandler(GetProfileQuery)
export class GetProfileHandler implements IQueryHandler<GetProfileQuery> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async execute({ userId }: GetProfileQuery): Promise<PublicUser> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return toPublicUser(user);
  }
}
