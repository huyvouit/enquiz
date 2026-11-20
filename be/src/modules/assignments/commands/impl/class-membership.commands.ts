import { Command } from '@nestjs/cqrs';

/*
 * Sent by the Classes module, and awaited, when its roster changes.
 *
 * These are commands rather than events on purpose: an event handler runs
 * after the HTTP response has been sent, and on Cloud Run the CPU is throttled
 * once the response is out (roadmap 4.0), so the update could stall or be
 * lost. Awaiting a command also means the next request already sees the new
 * homework list.
 */

/**
 * Students were added to a class (joined with the code or created in bulk):
 * they get the class's open whole-class homework that is not overdue yet
 * (plan D8). Group/hand-picked homework is not changed.
 */
export class AddJoinersToAssignmentsCommand extends Command<void> {
  constructor(
    public readonly classId: string,
    public readonly studentIds: string[],
  ) {
    super();
  }
}

/** The teacher removed a student: they no longer count as "not submitted". */
export class RemoveLeaverFromAssignmentsCommand extends Command<void> {
  constructor(
    public readonly classId: string,
    public readonly studentId: string,
  ) {
    super();
  }
}
