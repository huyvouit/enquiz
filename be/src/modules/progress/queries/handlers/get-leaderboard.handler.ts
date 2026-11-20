import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Role } from '../../../../common/enums/role.enum.js';
import { ClassAccessQuery } from '../../../classes/queries/impl/class-membership.queries.js';
import { User } from '../../../users/schemas/user.schema.js';
import { shortName } from '../../../users/users.mapper.js';
import { periodStart } from '../../progression/progression.rules.js';
import { StudentProgress } from '../../schemas/student-progress.schema.js';
import { GetLeaderboardQuery } from '../impl/progression.queries.js';
import { LeaderboardEntry, LeaderboardView } from './progression.views.js';

const TOP = 20;

interface Row {
  studentId: Types.ObjectId;
  fullName: string;
  level: number;
  xp: number;
}

/** Which students are ranked: one grade, or the members of one class. */
interface Population {
  grade: number;
  memberIds: Types.ObjectId[] | null;
}

/**
 * Ranks students by XP gained in the current week/month, or in total.
 * Students with 0 XP in the period are not listed.
 * - scope=grade: every student of the grade; names shortened ("Anh N.")
 *   because the list spans schools (plan D3).
 * - scope=class: members of one class; full names. Only the class's
 *   students, its teacher and admins may see it.
 * Usernames are never shown to other children.
 */
@QueryHandler(GetLeaderboardQuery)
export class GetLeaderboardHandler implements IQueryHandler<GetLeaderboardQuery> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(StudentProgress.name)
    private readonly progressModel: Model<StudentProgress>,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({
    user,
    period,
    gradeLevel,
    scope,
    classId,
  }: GetLeaderboardQuery): Promise<LeaderboardView> {
    let population: Population;
    let classInfo: { id: string; name: string } | null = null;

    if (scope === 'class' && classId) {
      const c = await this.queryBus.execute(
        new ClassAccessQuery(classId, user, 'view'),
      );
      classInfo = { id: c.id, name: c.name };
      population = {
        grade: c.gradeLevel,
        memberIds: c.studentIds.map((id) => new Types.ObjectId(id)),
      };
    } else {
      const me = await this.userModel
        .findById(user.userId, { studentProfile: 1 })
        .lean();
      population = {
        grade: gradeLevel ?? me?.studentProfile?.gradeLevel ?? 1,
        memberIds: null,
      };
    }

    const since = periodStart(period);
    const rows = since
      ? await this.periodRows(population, since)
      : await this.allTimeRows(population);

    const ranked = rank(rows).map((e) =>
      scope === 'class' ||
      (user.role === Role.STUDENT && e.studentId === user.userId)
        ? e
        : { ...e, fullName: shortName(e.fullName) },
    );
    return {
      period,
      scope: classInfo ? 'class' : 'grade',
      gradeLevel: population.grade,
      classId: classInfo?.id ?? null,
      className: classInfo?.name ?? null,
      since,
      entries: ranked.slice(0, TOP),
      me: ranked.find((r) => r.studentId === user.userId) ?? null,
    };
  }

  private async allTimeRows(p: Population): Promise<Row[]> {
    const where: QueryFilter<User> = {
      role: Role.STUDENT,
      'studentProfile.xp': { $gt: 0 },
    };
    if (p.memberIds) where._id = { $in: p.memberIds };
    else where['studentProfile.gradeLevel'] = p.grade;

    const users = await this.userModel
      .find(where, { fullName: 1, studentProfile: 1 })
      .lean();
    return users.map((u) => ({
      studentId: u._id,
      fullName: u.fullName,
      level: u.studentProfile?.level ?? 1,
      xp: u.studentProfile?.xp ?? 0,
    }));
  }

  private periodRows(p: Population, since: Date): Promise<Row[]> {
    const match: Record<string, unknown> = {
      completedAt: { $gte: since },
      xpEarned: { $gt: 0 },
    };
    if (p.memberIds) match.studentId = { $in: p.memberIds };

    return this.progressModel.aggregate<Row>([
      { $match: match },
      { $group: { _id: '$studentId', xp: { $sum: '$xpEarned' } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      ...(p.memberIds
        ? []
        : [{ $match: { 'user.studentProfile.gradeLevel': p.grade } }]),
      {
        $project: {
          _id: 0,
          studentId: '$_id',
          xp: 1,
          fullName: '$user.fullName',
          level: { $ifNull: ['$user.studentProfile.level', 1] },
        },
      },
    ]);
  }
}

/** Highest XP first; equal XP shares a rank (1, 2, 2, 4). */
function rank(rows: Row[]): LeaderboardEntry[] {
  const sorted = [...rows].sort(
    (a, b) => b.xp - a.xp || a.fullName.localeCompare(b.fullName, 'vi'),
  );
  return sorted.map((r, i) => {
    const firstWithSameXp = sorted.findIndex((x) => x.xp === r.xp);
    return {
      rank: (firstWithSameXp === -1 ? i : firstWithSameXp) + 1,
      studentId: r.studentId.toString(),
      fullName: r.fullName,
      level: r.level,
      xp: r.xp,
    };
  });
}
