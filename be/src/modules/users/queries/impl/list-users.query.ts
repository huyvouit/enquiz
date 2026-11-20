import { Query } from '@nestjs/cqrs';
import type { Paginated } from '../../../../common/utils/pagination.js';
import type { ListUsersDto } from '../../dto/admin-users.dto.js';
import type { PublicUser } from '../../users.mapper.js';

/** Admin user list (newest first). */
export class ListUsersQuery extends Query<Paginated<PublicUser>> {
  constructor(public readonly filters: ListUsersDto) {
    super();
  }
}
