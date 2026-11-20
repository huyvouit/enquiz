import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../../../users/schemas/user.schema.js';
import {
  CLASS_NOT_FOUND,
  canManageClass,
  canViewClass,
} from '../../class-access.js';
import { toGroupView } from '../../classes.mapper.js';
import { ClassRoom, ClassStatus } from '../../schemas/class-room.schema.js';
import {
  ClassAccess,
  ClassAccessQuery,
  StudentClassIdsQuery,
  TeachesStudentQuery,
} from '../impl/class-membership.queries.js';

@QueryHandler(TeachesStudentQuery)
export class TeachesStudentHandler implements IQueryHandler<TeachesStudentQuery> {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
  ) {}

  async execute({
    teacherId,
    studentId,
  }: TeachesStudentQuery): Promise<boolean> {
    if (!Types.ObjectId.isValid(studentId)) return false;
    const found = await this.classModel.exists({
      teacherId: new Types.ObjectId(teacherId),
      studentIds: new Types.ObjectId(studentId),
      status: ClassStatus.ACTIVE,
    });
    return found !== null;
  }
}

@QueryHandler(ClassAccessQuery)
export class ClassAccessHandler implements IQueryHandler<ClassAccessQuery> {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async execute({
    classId,
    user,
    mode,
  }: ClassAccessQuery): Promise<ClassAccess> {
    const c = Types.ObjectId.isValid(classId)
      ? await this.classModel.findById(classId).lean()
      : null;
    const allowed =
      c &&
      (mode === 'manage' ? canManageClass(user, c) : canViewClass(user, c));
    if (!c || !allowed) throw new NotFoundException(CLASS_NOT_FOUND);

    const teacher = await this.userModel
      .findById(c.teacherId, { fullName: 1 })
      .lean();
    return {
      id: c._id.toString(),
      name: c.name,
      gradeLevel: c.gradeLevel,
      schoolName: c.schoolName ?? null,
      teacherId: c.teacherId.toString(),
      teacherName: teacher?.fullName ?? '',
      studentIds: c.studentIds.map(String),
      groups: c.groups.map(toGroupView),
    };
  }
}

@QueryHandler(StudentClassIdsQuery)
export class StudentClassIdsHandler implements IQueryHandler<StudentClassIdsQuery> {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
  ) {}

  async execute({ studentId }: StudentClassIdsQuery): Promise<string[]> {
    const ids = await this.classModel.distinct('_id', {
      studentIds: new Types.ObjectId(studentId),
      status: ClassStatus.ACTIVE,
    });
    return ids.map(String);
  }
}
