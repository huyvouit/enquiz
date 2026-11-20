import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type {
  ClassDetail,
  ClassSummary,
  StudentClassView,
} from '../../classes.mapper.js';

/** Teacher: classes I teach (admin: all). Student: classes I am in. */
export class ListMyClassesQuery extends Query<
  ClassSummary[] | StudentClassView[]
> {
  constructor(
    public readonly user: AuthUser,
    public readonly includeArchived: boolean,
  ) {
    super();
  }
}

export class GetClassDetailQuery extends Query<ClassDetail> {
  constructor(
    public readonly classId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
