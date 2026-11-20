import { Types } from 'mongoose';
import { Role } from '../../../../common/enums/role.enum.js';
import {
  AddJoinersToAssignmentsCommand,
  RemoveLeaverFromAssignmentsCommand,
} from '../../../assignments/commands/impl/class-membership.commands.js';
import { BulkCreateStudentsCommand } from '../impl/class.commands.js';
import { BulkCreateStudentsHandler } from './class-roster.handlers.js';

const teacherId = new Types.ObjectId();
const classId = new Types.ObjectId();
const teacher = {
  userId: teacherId.toString(),
  username: 't',
  role: Role.TEACHER,
};

/** Minimal stand-ins for the models and buses the handler touches. */
function setup(fail: { classUpdate?: boolean; assignments?: boolean }) {
  const created: Types.ObjectId[] = [];
  const classModel = {
    findById: () => ({
      lean: async () => ({
        _id: classId,
        teacherId,
        studentIds: [],
        gradeLevel: 2,
        groups: [],
      }),
    }),
    updateOne: vi.fn(async (_filter: unknown, update: object) => {
      if (fail.classUpdate && '$addToSet' in update) throw new Error('db down');
      return { matchedCount: 1 };
    }),
  };
  const userModel = {
    find: () => ({ lean: async () => [] }),
    insertMany: vi.fn(async (docs: object[]) =>
      docs.map(() => {
        const _id = new Types.ObjectId();
        created.push(_id);
        return { _id };
      }),
    ),
    deleteMany: vi.fn(async () => ({ deletedCount: created.length })),
  };
  const commandBus = {
    execute: vi.fn(async (cmd: unknown) => {
      if (fail.assignments && cmd instanceof AddJoinersToAssignmentsCommand) {
        throw new Error('assignments down');
      }
    }),
  };
  const queryBus = { execute: vi.fn(async () => ({ id: classId.toString() })) };
  const handler = new BulkCreateStudentsHandler(
    classModel as never,
    userModel as never,
    queryBus as never,
    commandBus as never,
  );
  const run = () =>
    handler.execute(
      new BulkCreateStudentsCommand(
        classId.toString(),
        ['Bé An', 'Bé Bình'],
        teacher,
      ),
    );
  return { run, created, classModel, userModel, commandBus };
}

describe('BulkCreateStudentsHandler (plan D17)', () => {
  it('deletes the new accounts when adding them to the class fails', async () => {
    const { run, created, userModel, commandBus } = setup({
      classUpdate: true,
    });
    await expect(run()).rejects.toThrow('db down');
    expect(created).toHaveLength(2);
    expect(userModel.deleteMany).toHaveBeenCalledWith({
      _id: { $in: created },
    });
    const removed = commandBus.execute.mock.calls
      .map(([c]) => c)
      .filter((c) => c instanceof RemoveLeaverFromAssignmentsCommand);
    expect(removed).toHaveLength(2);
  });

  it('also takes them out of the class when the homework step fails', async () => {
    const { run, created, classModel, userModel } = setup({
      assignments: true,
    });
    await expect(run()).rejects.toThrow('assignments down');
    expect(classModel.updateOne).toHaveBeenLastCalledWith(
      { _id: classId },
      { $pull: { studentIds: { $in: created } } },
    );
    expect(userModel.deleteMany).toHaveBeenCalledWith({
      _id: { $in: created },
    });
  });

  it('keeps the accounts when everything succeeds', async () => {
    const { run, userModel } = setup({});
    const res = await run();
    expect(res.created).toHaveLength(2);
    expect(userModel.deleteMany).not.toHaveBeenCalled();
  });
});
