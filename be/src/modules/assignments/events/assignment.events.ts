import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

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
