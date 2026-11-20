import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import type { Paginated } from '../../../../common/utils/pagination.js';
import { escapeRegex } from '../../../../common/utils/regex.js';
import { User } from '../../schemas/user.schema.js';
import { PublicUser, toPublicUser } from '../../users.mapper.js';
import { ListUsersQuery } from '../impl/list-users.query.js';

@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async execute({ filters }: ListUsersQuery): Promise<Paginated<PublicUser>> {
    const where: QueryFilter<User> = {};
    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.search?.trim()) {
      const re = new RegExp(escapeRegex(filters.search.trim()), 'i');
      where.$or = [{ username: re }, { fullName: re }];
    }
    const { page, limit } = filters;
    const [items, total] = await Promise.all([
      this.userModel
        .find(where)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(where),
    ]);
    return { items: items.map(toPublicUser), total, page, limit };
  }
}
