import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  StudentLeftClassEvent,
  StudentsJoinedClassEvent,
} from '../../classes/events/impl/class-membership.events.js';
import { Assignment, AssignmentStatus } from '../schemas/assignment.schema.js';

/** Hook for notifications (web push, parents) in phase 4. Logs for now. */
export class AssignmentCreatedEvent {
  constructor(
    public readonly assignmentId: string,
    public readonly classId: string,
    public readonly studentCount: number,
  ) {}
}

@EventsHandler(AssignmentCreatedEvent)
export class AssignmentCreatedLogHandler implements IEventHandler<AssignmentCreatedEvent> {
  private readonly logger = new Logger('Assignments');

  handle(e: AssignmentCreatedEvent) {
    this.logger.log(
      `Assignment ${e.assignmentId} given to ${e.studentCount} students of class ${e.classId}`,
    );
  }
}

/**
 * A student who joins later gets the class's open whole-class homework that
 * is not overdue yet (plan D8). Group/hand-picked homework is not changed.
 */
@EventsHandler(StudentsJoinedClassEvent)
export class AddJoinersToAssignmentsHandler implements IEventHandler<StudentsJoinedClassEvent> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
  ) {}

  async handle({ classId, studentIds }: StudentsJoinedClassEvent) {
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

/** A student who leaves the class no longer counts as "not submitted". */
@EventsHandler(StudentLeftClassEvent)
export class RemoveLeaverFromAssignmentsHandler implements IEventHandler<StudentLeftClassEvent> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
  ) {}

  async handle({ classId, studentId }: StudentLeftClassEvent) {
    await this.assignmentModel.updateMany(
      { classId: new Types.ObjectId(classId) },
      { $pull: { studentIds: new Types.ObjectId(studentId) } },
    );
  }
}
