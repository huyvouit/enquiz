import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Role } from '../../../../common/enums/role.enum.js';
import { User } from '../../../users/schemas/user.schema.js';
import { loadManagedClass } from '../../class-access.js';
import {
  byVietnameseName,
  ClassDetail,
  ClassSummary,
  StudentClassView,
  toClassStudent,
  toClassSummary,
  toGroupView,
} from '../../classes.mapper.js';
import { ClassRoom, ClassStatus } from '../../schemas/class-room.schema.js';
import {
  GetClassDetailQuery,
  ListMyClassesQuery,
} from '../impl/class-views.queries.js';

@QueryHandler(ListMyClassesQuery)
export class ListMyClassesHandler implements IQueryHandler<ListMyClassesQuery> {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async execute({
    user,
    includeArchived,
  }: ListMyClassesQuery): Promise<ClassSummary[] | StudentClassView[]> {
    const me = new Types.ObjectId(user.userId);
    const where: QueryFilter<ClassRoom> = {};
    if (user.role === Role.STUDENT) where.studentIds = me;
    else if (user.role === Role.TEACHER) where.teacherId = me;
    if (user.role === Role.STUDENT || !includeArchived) {
      where.status = ClassStatus.ACTIVE;
    }

    const classes = await this.classModel
      .find(where)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const teachers = new Map(
      (
        await this.userModel
          .find(
            { _id: { $in: [...new Set(classes.map((c) => c.teacherId))] } },
            { fullName: 1 },
          )
          .lean()
      ).map((t) => [t._id.toString(), t]),
    );

    if (user.role === Role.STUDENT) {
      return classes.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        gradeLevel: c.gradeLevel,
        teacherName: teachers.get(c.teacherId.toString())?.fullName ?? null,
      }));
    }
    return classes.map((c) =>
      toClassSummary(c, teachers.get(c.teacherId.toString()) ?? null),
    );
  }
}

@QueryHandler(GetClassDetailQuery)
export class GetClassDetailHandler implements IQueryHandler<GetClassDetailQuery> {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async execute({ classId, user }: GetClassDetailQuery): Promise<ClassDetail> {
    const c = await loadManagedClass(this.classModel, classId, user);
    const [teacher, students] = await Promise.all([
      this.userModel.findById(c.teacherId, { fullName: 1 }).lean(),
      this.userModel.find({ _id: { $in: c.studentIds } }).lean(),
    ]);
    return {
      ...toClassSummary(c, teacher),
      students: students.map(toClassStudent).sort(byVietnameseName),
      groups: c.groups.map(toGroupView),
    };
  }
}
