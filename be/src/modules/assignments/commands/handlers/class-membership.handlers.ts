import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Assignment,
  AssignmentStatus,
} from '../../schemas/assignment.schema.js';
import {
  AddJoinersToAssignmentsCommand,
  RemoveLeaverFromAssignmentsCommand,
} from '../impl/class-membership.commands.js';

@CommandHandler(AddJoinersToAssignmentsCommand)
export class AddJoinersToAssignmentsHandler implements ICommandHandler<AddJoinersToAssignmentsCommand> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
  ) {}

  async execute({
    classId,
    studentIds,
  }: AddJoinersToAssignmentsCommand): Promise<void> {
    await this.assignmentModel.updateMany(
      {
        classId: new Types.ObjectId(classId),
        'target.kind': 'class',
        status: AssignmentStatus.ACTIVE,
        dueDate: { $gt: new Date() },
      },
      {
        $addToSet: {
          studentIds: { $each: studentIds.map((id) => new Types.ObjectId(id)) },
        },
      },
    );
  }
}

@CommandHandler(RemoveLeaverFromAssignmentsCommand)
export class RemoveLeaverFromAssignmentsHandler implements ICommandHandler<RemoveLeaverFromAssignmentsCommand> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
  ) {}

  async execute({
    classId,
    studentId,
  }: RemoveLeaverFromAssignmentsCommand): Promise<void> {
    await this.assignmentModel.updateMany(
      { classId: new Types.ObjectId(classId) },
      { $pull: { studentIds: new Types.ObjectId(studentId) } },
    );
  }
}
