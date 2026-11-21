import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CommandBus,
  CommandHandler,
  ICommandHandler,
  QueryBus,
} from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { AccountStatus } from '../../../../common/enums/account-status.enum.js';
import { Role } from '../../../../common/enums/role.enum.js';
import { SlidingWindowLimiter } from '../../../../common/rate-limit/sliding-window-limiter.js';
import { escapeRegex } from '../../../../common/utils/regex.js';
import {
  BCRYPT_ROUNDS,
  kidPassword,
} from '../../../../common/utils/passwords.js';
import {
  AddJoinersToAssignmentsCommand,
  RemoveLeaverFromAssignmentsCommand,
} from '../../../assignments/commands/impl/class-membership.commands.js';
import { User } from '../../../users/schemas/user.schema.js';
import { loadManagedClass } from '../../class-access.js';
import {
  normalizeClassCode,
  pickUsername,
  usernameStem,
} from '../../class-rules.js';
import {
  ClassDetail,
  CreatedStudent,
  StudentClassView,
} from '../../classes.mapper.js';
import { GetClassDetailQuery } from '../../queries/impl/class-views.queries.js';
import {
  CLASS_MAX_STUDENTS,
  ClassRoom,
  ClassStatus,
} from '../../schemas/class-room.schema.js';
import {
  BulkCreateStudentsCommand,
  JoinClassCommand,
  RemoveStudentCommand,
} from '../impl/class.commands.js';

const CLASS_FULL = `Lớp đã đủ ${CLASS_MAX_STUDENTS} học sinh`;
/** Wrong class codes per student per minute before a pause (launch A3). */
export const WRONG_CODES_PER_MINUTE = 10;
export const TOO_MANY_CODES =
  'Em nhập sai mã nhiều quá, chờ 1 phút rồi thử lại nhé';

@CommandHandler(JoinClassCommand)
export class JoinClassHandler implements ICommandHandler<JoinClassCommand> {
  /** Codes are 6 letters: without a limit a script could guess them. */
  private readonly wrongCodes = new SlidingWindowLimiter(
    WRONG_CODES_PER_MINUTE,
    60_000,
  );

  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({ code, user }: JoinClassCommand): Promise<StudentClassView> {
    if (!this.wrongCodes.allowed(user.userId)) {
      throw new HttpException(TOO_MANY_CODES, HttpStatus.TOO_MANY_REQUESTS);
    }
    const c = await this.classModel
      .findOne({ code: normalizeClassCode(code), status: ClassStatus.ACTIVE })
      .lean();
    if (!c) {
      this.wrongCodes.hit(user.userId);
      throw new NotFoundException(
        'Mã lớp không đúng. Em kiểm tra lại với cô nhé!',
      );
    }

    const me = new Types.ObjectId(user.userId);
    const alreadyIn = c.studentIds.some((id) => id.equals(me));
    if (!alreadyIn) {
      // The size condition makes "check capacity + add" a single atomic step.
      const res = await this.classModel.updateOne(
        {
          _id: c._id,
          [`studentIds.${CLASS_MAX_STUDENTS - 1}`]: { $exists: false },
        },
        { $addToSet: { studentIds: me } },
      );
      if (res.matchedCount === 0) throw new ConflictException(CLASS_FULL);
      await this.commandBus.execute(
        new AddJoinersToAssignmentsCommand(c._id.toString(), [user.userId]),
      );
    }

    const teacher = await this.userModel
      .findById(c.teacherId, { fullName: 1 })
      .lean();
    return {
      id: c._id.toString(),
      name: c.name,
      gradeLevel: c.gradeLevel,
      teacherName: teacher?.fullName ?? null,
    };
  }
}

@CommandHandler(BulkCreateStudentsCommand)
export class BulkCreateStudentsHandler implements ICommandHandler<BulkCreateStudentsCommand> {
  private readonly logger = new Logger(BulkCreateStudentsHandler.name);

  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({
    classId,
    fullNames,
    user,
  }: BulkCreateStudentsCommand): Promise<{
    class: ClassDetail;
    created: CreatedStudent[];
  }> {
    const c = await loadManagedClass(this.classModel, classId, user);
    const names = fullNames
      .map((n) => n.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (names.length === 0)
      throw new BadRequestException('Danh sách tên đang trống');
    if (c.studentIds.length + names.length > CLASS_MAX_STUDENTS) {
      throw new ConflictException(
        `${CLASS_FULL} (đang có ${c.studentIds.length}, thêm ${names.length})`,
      );
    }

    // Reserve usernames against everything already taken with the same stems.
    const stems = names.map(usernameStem);
    const existing = await this.userModel
      .find(
        {
          username: {
            $in: [...new Set(stems)].map(
              (s) => new RegExp(`^${escapeRegex(s)}\\d*$`),
            ),
          },
        },
        { username: 1 },
      )
      .lean();
    const taken = new Set(existing.map((u) => u.username));

    const accounts = names.map((fullName, i) => {
      const username = pickUsername(stems[i], taken);
      taken.add(username);
      return { fullName, username, password: kidPassword() };
    });

    const docs = await this.userModel.insertMany(
      await Promise.all(
        accounts.map(async (a) => ({
          username: a.username,
          fullName: a.fullName,
          password: await bcrypt.hash(a.password, BCRYPT_ROUNDS),
          role: Role.STUDENT,
          status: AccountStatus.ACTIVE,
          studentProfile: { gradeLevel: c.gradeLevel },
        })),
      ),
    );
    const ids = docs.map((d) => d._id);
    try {
      await this.classModel.updateOne(
        { _id: c._id },
        { $addToSet: { studentIds: { $each: ids } } },
      );
      await this.commandBus.execute(
        new AddJoinersToAssignmentsCommand(classId, ids.map(String)),
      );
    } catch (err) {
      // Plan D17: no transaction, so undo the accounts that were just created
      // instead of leaving students who belong to no class.
      await this.undoCreated(classId, ids);
      throw err;
    }

    return {
      class: await this.queryBus.execute(
        new GetClassDetailQuery(classId, user),
      ),
      created: accounts.map((a, i) => ({ id: ids[i].toString(), ...a })),
    };
  }

  /** Best effort: a failure here is logged, the original error still wins. */
  private async undoCreated(classId: string, ids: Types.ObjectId[]) {
    try {
      await this.classModel.updateOne(
        { _id: new Types.ObjectId(classId) },
        { $pull: { studentIds: { $in: ids } } },
      );
      for (const id of ids) {
        await this.commandBus.execute(
          new RemoveLeaverFromAssignmentsCommand(classId, id.toString()),
        );
      }
      await this.userModel.deleteMany({ _id: { $in: ids } });
    } catch (cleanupErr) {
      this.logger.error(
        `Could not undo ${ids.length} new students of class ${classId}`,
        cleanupErr instanceof Error ? cleanupErr.stack : String(cleanupErr),
      );
    }
  }
}

@CommandHandler(RemoveStudentCommand)
export class RemoveStudentHandler implements ICommandHandler<RemoveStudentCommand> {
  constructor(
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({
    classId,
    studentId,
    user,
  }: RemoveStudentCommand): Promise<void> {
    const c = await loadManagedClass(this.classModel, classId, user);
    const sid = new Types.ObjectId(studentId);
    if (!c.studentIds.some((id) => id.equals(sid))) {
      throw new NotFoundException('Học sinh không ở trong lớp này');
    }
    await this.classModel.updateOne(
      { _id: c._id },
      { $pull: { studentIds: sid, 'groups.$[].studentIds': sid } },
    );
    await this.commandBus.execute(
      new RemoveLeaverFromAssignmentsCommand(classId, studentId),
    );
  }
}
