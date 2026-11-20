import { Query } from '@nestjs/cqrs';
import type { PublicUser } from '../../users.mapper.js';

export class GetProfileQuery extends Query<PublicUser> {
  constructor(public readonly userId: string) {
    super();
  }
}
