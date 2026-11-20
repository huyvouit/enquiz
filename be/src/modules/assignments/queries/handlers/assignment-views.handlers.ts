import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { byVietnameseName } from '../../../classes/classes.mapper.js';
import { ClassAccessQuery } from '../../../classes/queries/impl/class-membership.queries.js';
import { ClassRoom } from '../../../classes/schemas/class-room.schema.js';
import { User } from '../../../users/schemas/user.schema.js';
import { loadManagedAssignment } from '../../assignment-access.js';
import { isDueSoon, isNew } from '../../assignment-status.js';
import { AssignmentSubmissionsService } from '../../assignment-submissions.service.js';
import {
  AssignmentDetail,
  AssignmentView,
  MyAssignment,
  ReminderView,
  toQuizRef,
} from '../../assignments.mapper.js';
import {
  Assignment,
  AssignmentStatus,
} from '../../schemas/assignment.schema.js';
import {
  GetAssignmentDetailQuery,
  ListClassAssignmentsQuery,
  MyAssignmentsQuery,
  MyRemindersQuery,
} from '../impl/assignment.queries.js';

const REMINDER_LIST_MAX = 5;

@QueryHandler(ListClassAssignmentsQuery)
export class ListClassAssignmentsHandler implements IQueryHandler<ListClassAssignmentsQuery> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    private readonly queryBus: QueryBus,
    private readonly submissions: AssignmentSubmissionsService,
  ) {}

  async execute({
    classId,
    status,
    user,
  }: ListClassAssignmentsQuery): Promise<AssignmentView[]> {
    const c = await this.queryBus.execute(
      new ClassAccessQuery(classId, user, 'manage'),
    );
    const where: QueryFilter<Assignment> = {
      classId: new Types.ObjectId(c.id),
    };
    if (status !== 'all') where.status = status as AssignmentStatus;
    const assignments = await this.assignmentModel
      .find(where)
      .sort({ dueDate: -1, _id: -1 })
      .limit(200)
      .lean();
    return this.submissions.views(assignments);
  }
}

@QueryHandler(GetAssignmentDetailQuery)
export class GetAssignmentDetailHandler implements IQueryHandler<GetAssignmentDetailQuery> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly queryBus: QueryBus,
    private readonly submissions: AssignmentSubmissionsService,
  ) {}

  async execute({
    assignmentId,
    user,
  }: GetAssignmentDetailQuery): Promise<AssignmentDetail> {
    const { assignment, classAccess } = await loadManagedAssignment(
      this.assignmentModel,
      this.queryBus,
      assignmentId,
      user,
    );
    const [[view], index, students] = await Promise.all([
      this.submissions.views([assignment]),
      this.submissions.attempts([assignment._id]),
      this.userModel
        .find(
          { _id: { $in: assignment.studentIds } },
          { fullName: 1, username: 1 },
        )
        .lean(),
    ]);
    const subs = this.submissions.submissions(assignment, index);
    const rows = students
      .map((s) => ({
        student: {
          id: s._id.toString(),
          fullName: s.fullName,
          username: s.username,
        },
        ...subs.get(s._id.toString())!,
      }))
      .sort((a, b) => byVietnameseName(a.student, b.student));
    return { ...view, className: classAccess.name, submissions: rows };
  }
}

/** Builds the student's homework list; reused by the reminders query. */
async function myAssignments(
  assignmentModel: Model<Assignment>,
  classModel: Model<ClassRoom>,
  userModel: Model<User>,
  submissions: AssignmentSubmissionsService,
  studentId: string,
  onlyActive: boolean,
): Promise<MyAssignment[]> {
  const sid = new Types.ObjectId(studentId);
  const where: QueryFilter<Assignment> = { studentIds: sid };
  if (onlyActive) where.status = AssignmentStatus.ACTIVE;
  const assignments = await assignmentModel
    .find(where)
    .sort({ dueDate: 1 })
    .limit(300)
    .lean();
  if (assignments.length === 0) return [];

  const [index, quizzes, classes] = await Promise.all([
    submissions.attempts(
      assignments.map((a) => a._id),
      sid,
    ),
    submissions.quizzes(assignments.map((a) => a.quizId)),
    classModel
      .find(
        { _id: { $in: [...new Set(assignments.map((a) => a.classId))] } },
        { name: 1, teacherId: 1 },
      )
      .lean(),
  ]);
  const classById = new Map(classes.map((c) => [c._id.toString(), c]));
  const teachers = new Map(
    (
      await userModel
        .find(
          { _id: { $in: classes.map((c) => c.teacherId) } },
          { fullName: 1 },
        )
        .lean()
    ).map((t) => [t._id.toString(), t.fullName]),
  );

  const now = new Date();
  return assignments.map((a) => {
    const submission = submissions.submissions(a, index, now).get(studentId)!;
    const c = classById.get(a.classId.toString());
    const notSubmitted = submission.score === null;
    return {
      ...submission,
      id: a._id.toString(),
      classId: a.classId.toString(),
      className: c?.name ?? '',
      teacherName: c ? (teachers.get(c.teacherId.toString()) ?? '') : '',
      quiz: toQuizRef(quizzes.get(a.quizId.toString())),
      dueDate: a.dueDate,
      note: a.note ?? null,
      createdAt: a.createdAt,
      closed: a.status === AssignmentStatus.CLOSED,
      isNew: notSubmitted && isNew(a.createdAt, now),
      dueSoon: notSubmitted && isDueSoon(a.dueDate, now),
    };
  });
}

@QueryHandler(MyAssignmentsQuery)
export class MyAssignmentsHandler implements IQueryHandler<MyAssignmentsQuery> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly submissions: AssignmentSubmissionsService,
  ) {}

  execute({ user }: MyAssignmentsQuery): Promise<MyAssignment[]> {
    return myAssignments(
      this.assignmentModel,
      this.classModel,
      this.userModel,
      this.submissions,
      user.userId,
      false,
    );
  }
}

@QueryHandler(MyRemindersQuery)
export class MyRemindersHandler implements IQueryHandler<MyRemindersQuery> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly submissions: AssignmentSubmissionsService,
  ) {}

  async execute({ user }: MyRemindersQuery): Promise<ReminderView> {
    const open = (
      await myAssignments(
        this.assignmentModel,
        this.classModel,
        this.userModel,
        this.submissions,
        user.userId,
        true,
      )
    ).filter((a) => a.score === null);

    const overdue = open
      .filter((a) => a.state === 'missing')
      .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
    const dueSoon = open.filter((a) => a.dueSoon);
    const fresh = open.filter(
      (a) => a.isNew && !a.dueSoon && a.state === 'pending',
    );
    return {
      pendingCount: open.length,
      overdue: overdue.slice(0, REMINDER_LIST_MAX),
      dueSoon: dueSoon.slice(0, REMINDER_LIST_MAX),
      fresh: fresh.slice(0, REMINDER_LIST_MAX),
    };
  }
}
