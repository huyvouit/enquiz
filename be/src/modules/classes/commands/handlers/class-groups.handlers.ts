import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { loadManagedClass } from '../../class-access.js';
import { GroupView, toGroupView } from '../../classes.mapper.js';
import {
  CLASS_MAX_GROUPS,
  ClassRoom,
} from '../../schemas/class-room.schema.js';
import {
  DeleteGroupCommand,
  SaveGroupCommand,
} from '../impl/class.commands.js';

const GROUP_NOT_FOUND = 'Không tìm thấy nhóm';

@CommandHandler(SaveGroupCommand)
export class SaveGroupHandler implements ICommandHandler<SaveGroupCommand> {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
  ) {}

  async execute({
    classId,
    groupId,
    dto,
    user,
  }: SaveGroupCommand): Promise<GroupView> {
    const c = await loadManagedClass(this.classModel, classId, user);
    const members = new Set(c.studentIds.map(String));
    if (dto.studentIds.some((id) => !members.has(id))) {
      throw new BadRequestException('Nhóm chỉ gồm học sinh của lớp này');
    }
    const group = {
      name: dto.name.trim(),
      studentIds: dto.studentIds.map((id) => new Types.ObjectId(id)),
    };

    if (groupId === null) {
      if (c.groups.length >= CLASS_MAX_GROUPS) {
        throw new ConflictException(
          `Mỗi lớp có tối đa ${CLASS_MAX_GROUPS} nhóm`,
        );
      }
      const _id = new Types.ObjectId();
      await this.classModel.updateOne(
        { _id: c._id },
        { $push: { groups: { _id, ...group } } },
      );
      return toGroupView({ _id, ...group });
    }

    const res = await this.classModel.updateOne(
      { _id: c._id, 'groups._id': new Types.ObjectId(groupId) },
      {
        $set: {
          'groups.$.name': group.name,
          'groups.$.studentIds': group.studentIds,
        },
      },
    );
    if (res.matchedCount === 0) throw new NotFoundException(GROUP_NOT_FOUND);
    return toGroupView({ _id: new Types.ObjectId(groupId), ...group });
  }
}

@CommandHandler(DeleteGroupCommand)
export class DeleteGroupHandler implements ICommandHandler<DeleteGroupCommand> {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
  ) {}

  async execute({ classId, groupId, user }: DeleteGroupCommand): Promise<void> {
    const c = await loadManagedClass(this.classModel, classId, user);
    const res = await this.classModel.updateOne(
      { _id: c._id },
      { $pull: { groups: { _id: new Types.ObjectId(groupId) } } },
    );
    if (res.modifiedCount === 0) throw new NotFoundException(GROUP_NOT_FOUND);
  }
}
