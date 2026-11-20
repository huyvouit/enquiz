import { ServiceUnavailableException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../../../users/schemas/user.schema.js';
import { loadManagedClass } from '../../class-access.js';
import { generateClassCode } from '../../class-rules.js';
import {
  ClassDoc,
  ClassSummary,
  toClassSummary,
} from '../../classes.mapper.js';
import { ClassRoom } from '../../schemas/class-room.schema.js';
import {
  CreateClassCommand,
  RegenerateClassCodeCommand,
  UpdateClassCommand,
} from '../impl/class.commands.js';

const isDuplicateKey = (err: unknown) =>
  typeof err === 'object' &&
  err !== null &&
  (err as { code?: number }).code === 11000;

/**
 * Runs `write` with fresh codes until one is unique. 31^6 ≈ 887M codes, so a
 * collision is rare; five tries make a failure practically impossible.
 */
async function withUniqueCode<T>(
  write: (code: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await write(generateClassCode());
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
  }
  throw new ServiceUnavailableException(
    'Không tạo được mã lớp, vui lòng thử lại',
  );
}

async function summarize(
  userModel: Model<User>,
  c: ClassDoc,
): Promise<ClassSummary> {
  const teacher = await userModel.findById(c.teacherId, { fullName: 1 }).lean();
  return toClassSummary(c, teacher);
}

@CommandHandler(CreateClassCommand)
export class CreateClassHandler implements ICommandHandler<CreateClassCommand> {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async execute({ dto, user }: CreateClassCommand): Promise<ClassSummary> {
    const created = await withUniqueCode((code) =>
      this.classModel.create({
        name: dto.name.trim(),
        gradeLevel: dto.gradeLevel,
        schoolName: dto.schoolName?.trim() || undefined,
        teacherId: new Types.ObjectId(user.userId),
        code,
      }),
    );
    return summarize(this.userModel, created.toObject());
  }
}

@CommandHandler(UpdateClassCommand)
export class UpdateClassHandler implements ICommandHandler<UpdateClassCommand> {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async execute({
    classId,
    dto,
    user,
  }: UpdateClassCommand): Promise<ClassSummary> {
    await loadManagedClass(this.classModel, classId, user);
    const set: Partial<ClassRoom> = {};
    if (dto.name !== undefined) set.name = dto.name.trim();
    if (dto.gradeLevel !== undefined) set.gradeLevel = dto.gradeLevel;
    if (dto.schoolName !== undefined) set.schoolName = dto.schoolName.trim();
    if (dto.status !== undefined) set.status = dto.status;
    const updated = await this.classModel
      .findByIdAndUpdate(classId, { $set: set }, { returnDocument: 'after' })
      .lean();
    return summarize(this.userModel, updated!);
  }
}

@CommandHandler(RegenerateClassCodeCommand)
export class RegenerateClassCodeHandler implements ICommandHandler<RegenerateClassCodeCommand> {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async execute({
    classId,
    user,
  }: RegenerateClassCodeCommand): Promise<ClassSummary> {
    await loadManagedClass(this.classModel, classId, user);
    const updated = await withUniqueCode((code) =>
      this.classModel
        .findByIdAndUpdate(classId, { code }, { returnDocument: 'after' })
        .lean(),
    );
    return summarize(this.userModel, updated!);
  }
}
