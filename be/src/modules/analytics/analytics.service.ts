import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { vnStartOfWeek } from '../../common/utils/vn-time.js';
import {
  countStates,
  type Submission,
} from '../assignments/assignment-status.js';
import { AssignmentSubmissionsService } from '../assignments/assignment-submissions.service.js';
import type { AssignmentDoc } from '../assignments/assignments.mapper.js';
import { Assignment } from '../assignments/schemas/assignment.schema.js';
import { byVietnameseName as byName } from '../classes/classes.mapper.js';
import type { ClassAccess } from '../classes/queries/impl/class-membership.queries.js';
import { revealAnswer } from '../progress/grading/graders.js';
import { ProgressionService } from '../progress/progression/progression.service.js';
import {
  AnswerDetail,
  StudentProgress,
} from '../progress/schemas/student-progress.schema.js';
import { QuestionSkill } from '../questions/question-types.js';
import { Question } from '../questions/schemas/question.schema.js';
import { Quiz } from '../quizzes/schemas/quiz.schema.js';
import { User } from '../users/schemas/user.schema.js';
import {
  answerKey,
  ATTENTION_IDLE_DAYS,
  ATTENTION_MAX,
  attentionReasons,
  average,
  formatAnswer,
  MIN_TOPIC_ANSWERS,
  percent,
  toTenScale,
} from './analytics-rules.js';
import type {
  ClassOverview,
  DateRange,
  Gradebook,
  HeatCell,
  HeatmapQuestion,
  QuestionHeatmap,
  StudentRef,
  StudentReport,
  TopicHeatmap,
  TopicRate,
} from './analytics.views.js';

const SKILLS: QuestionSkill[] = [
  QuestionSkill.VOCABULARY,
  QuestionSkill.GRAMMAR,
  QuestionSkill.LISTENING,
];
const TREND_WEEKS = 8;
const HISTORY_MAX = 20;
const WEEK_MS = 7 * 86_400_000;

interface AttemptRow {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  quizId: Types.ObjectId;
  score: number;
  completedAt: Date;
  details: AnswerDetail[];
}

type QuestionMeta = Pick<
  Question,
  'questionText' | 'type' | 'topic' | 'skill' | 'pairs' | 'correctAnswer'
> & { _id: Types.ObjectId };

interface Tally {
  answered: number;
  correct: number;
}

const oid = (id: string) => new Types.ObjectId(id);

/**
 * Teacher analytics (plan 3.3). Every method receives a ClassAccess that the
 * caller obtained with mode "manage", so the class's data is never shown to
 * anyone else. All numbers are computed from student_progress when read.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(StudentProgress.name)
    private readonly progressModel: Model<StudentProgress>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    private readonly submissions: AssignmentSubmissionsService,
    private readonly progression: ProgressionService,
  ) {}

  // ---------- A. Overview ----------

  async overview(
    c: ClassAccess,
    range: DateRange,
    now = new Date(),
  ): Promise<ClassOverview> {
    const members = c.studentIds.map(oid);
    const [students, inRange, lastActive, assignments, topics] =
      await Promise.all([
        this.studentRefs(members),
        this.progressModel
          .find(
            {
              studentId: { $in: members },
              completedAt: { $gte: range.from, $lte: range.to },
            },
            { studentId: 1, score: 1 },
          )
          .lean(),
        this.lastActivity(members),
        this.classAssignments(c.id),
        this.topicHeatmap(c, range),
      ]);

    // Homework whose deadline passed inside the range.
    const due = assignments.filter(
      (a) =>
        a.dueDate >= range.from && a.dueDate <= range.to && a.dueDate <= now,
    );
    const index = await this.submissions.attempts(due.map((a) => a._id));
    const missing = new Map<string, number>();
    let assigned = 0;
    let onTime = 0;
    for (const a of due) {
      for (const [sid, s] of this.submissions.submissions(a, index, now)) {
        assigned++;
        if (s.state === 'on_time') onTime++;
        if (s.state === 'missing')
          missing.set(sid, (missing.get(sid) ?? 0) + 1);
      }
    }

    const scoresByStudent = new Map<string, number[]>();
    for (const r of inRange) {
      const key = r.studentId.toString();
      scoresByStudent.set(key, [...(scoresByStudent.get(key) ?? []), r.score]);
    }
    const idleSince = now.getTime() - ATTENTION_IDLE_DAYS * 86_400_000;
    const needsAttention = students
      .map((student) => {
        const averageScore = average(scoresByStudent.get(student.id) ?? []);
        const missingCount = missing.get(student.id) ?? 0;
        const last = lastActive.get(student.id) ?? null;
        return {
          student,
          reasons: attentionReasons({
            averageScore,
            missingCount,
            lastActiveAt: last,
            now,
          }),
          averageScore,
          missingCount,
          lastActiveAt: last,
        };
      })
      .filter((x) => x.reasons.length > 0)
      .sort(
        (a, b) =>
          b.reasons.length - a.reasons.length ||
          (a.averageScore ?? 101) - (b.averageScore ?? 101) ||
          byName(a.student, b.student),
      )
      .slice(0, ATTENTION_MAX);

    return {
      class: { id: c.id, name: c.name, gradeLevel: c.gradeLevel },
      range,
      studentCount: members.length,
      activeLast7Days: [...lastActive.values()].filter(
        (d) => d.getTime() >= idleSince,
      ).length,
      averageScore: average(inRange.map((r) => r.score)),
      attempts: inRange.length,
      onTimeRate: percent(onTime, assigned),
      openAssignments: assignments.filter(
        (a) => a.status === 'active' && a.dueDate > now,
      ).length,
      needsAttention,
      weakTopics: topics.cells
        .filter((t) => t.answered >= MIN_TOPIC_ANSWERS)
        .sort((a, b) => a.correctRate - b.correctRate)
        .slice(0, 3),
    };
  }

  // ---------- B1. Question heatmaps ----------

  async assignmentHeatmap(
    a: AssignmentDoc,
    c: ClassAccess,
  ): Promise<QuestionHeatmap> {
    const attempts = await this.firstAttempts({
      assignmentId: a._id,
      studentId: { $in: a.studentIds },
    });
    return this.heatmap(
      c,
      a.quizId,
      await this.studentRefs(a.studentIds),
      attempts,
      a._id.toString(),
    );
  }

  /** A quiz played by the class in any context (map or homework). */
  async quizHeatmap(quizId: string, c: ClassAccess): Promise<QuestionHeatmap> {
    const members = c.studentIds.map(oid);
    const attempts = await this.firstAttempts({
      quizId: oid(quizId),
      studentId: { $in: members },
    });
    return this.heatmap(
      c,
      oid(quizId),
      await this.studentRefs(members),
      attempts,
      null,
    );
  }

  private async heatmap(
    c: ClassAccess,
    quizId: Types.ObjectId,
    students: StudentRef[],
    attempts: AttemptRow[],
    assignmentId: string | null,
  ): Promise<QuestionHeatmap> {
    const quiz = await this.quizModel
      .findById(quizId, { title: 1, coverEmoji: 1, questionIds: 1 })
      .lean();
    const inQuiz = (quiz?.questionIds ?? []).map(String);
    const seen = new Set(inQuiz);
    const extra: string[] = [];
    for (const at of attempts) {
      for (const d of at.details) {
        const id = d.questionId.toString();
        if (!seen.has(id)) {
          seen.add(id);
          extra.push(id);
        }
      }
    }
    const order = [...inQuiz, ...extra];
    const meta = await this.questionMeta(order.map(oid));
    const byStudent = new Map(
      attempts.map((at) => [at.studentId.toString(), at]),
    );

    const rows = students.map((student) => {
      const at = byStudent.get(student.id);
      const details = new Map(
        (at?.details ?? []).map((d) => [d.questionId.toString(), d]),
      );
      const cells: HeatCell[] = order.map((qid) => {
        const d = details.get(qid);
        if (!d) return null;
        if (d.isCorrect) return 'correct';
        return d.studentAnswer === null ? 'skipped' : 'wrong';
      });
      return {
        student,
        score: at?.score ?? null,
        attemptId: at?._id.toString() ?? null,
        cells,
      };
    });

    const questions: HeatmapQuestion[] = order
      .filter((qid) => meta.has(qid))
      .map((qid) => {
        const q = meta.get(qid)!;
        const tally: Tally = { answered: 0, correct: 0 };
        const wrong = new Map<string, { answer: string; count: number }>();
        for (const at of attempts) {
          const d = at.details.find((x) => x.questionId.toString() === qid);
          if (!d) continue;
          tally.answered++;
          if (d.isCorrect) tally.correct++;
          else if (d.studentAnswer !== null) {
            const key = answerKey(d.studentAnswer);
            const prev = wrong.get(key);
            wrong.set(key, {
              answer: prev?.answer ?? formatAnswer(d.studentAnswer),
              count: (prev?.count ?? 0) + 1,
            });
          }
        }
        const common = [...wrong.values()].sort((a, b) => b.count - a.count)[0];
        return {
          id: qid,
          index: order.indexOf(qid) + 1,
          questionText: q.questionText,
          type: q.type,
          topic: q.topic,
          skill: q.skill ?? QuestionSkill.VOCABULARY,
          correctAnswer: formatAnswer(revealAnswer(q)),
          inQuiz: inQuiz.includes(qid),
          answered: tally.answered,
          correct: tally.correct,
          correctRate: percent(tally.correct, tally.answered),
          commonWrongAnswer: common ?? null,
        };
      });
    // Keep row cells aligned with the questions that still exist.
    const kept = order.map((qid) => meta.has(qid));
    for (const r of rows) r.cells = r.cells.filter((_, i) => kept[i]);

    return {
      className: c.name,
      quiz: quiz
        ? {
            id: quiz._id.toString(),
            title: quiz.title,
            coverEmoji: quiz.coverEmoji,
          }
        : null,
      assignmentId,
      questions,
      rows,
      firstAttemptOnly: true,
    };
  }

  // ---------- B2. Topic x skill ----------

  async topicHeatmap(c: ClassAccess, range: DateRange): Promise<TopicHeatmap> {
    const attempts = await this.firstAttempts({
      studentId: { $in: c.studentIds.map(oid) },
      completedAt: { $gte: range.from, $lte: range.to },
    });
    const tallies = await this.tallies(
      attempts,
      (q) => `${q.topic}\u0000${q.skill}`,
    );
    const cells: TopicRate[] = [...tallies.entries()].map(([key, t]) => {
      const [topic, skill] = key.split('\u0000');
      return {
        topic,
        skill: skill as QuestionSkill,
        correctRate: percent(t.correct, t.answered) ?? 0,
        answered: t.answered,
      };
    });
    return {
      range,
      topics: [...new Set(cells.map((x) => x.topic))].sort((a, b) =>
        a.localeCompare(b, 'vi'),
      ),
      skills: SKILLS,
      cells,
      minAnswers: MIN_TOPIC_ANSWERS,
    };
  }

  // ---------- C. Student report ----------

  async studentReport(
    c: ClassAccess,
    studentId: string,
    range: DateRange,
    now = new Date(),
  ): Promise<StudentReport> {
    if (!c.studentIds.includes(studentId)) {
      throw new NotFoundException('Học sinh không ở trong lớp này');
    }
    const sid = oid(studentId);
    const user = await this.userModel.findById(sid).lean();
    if (!user) throw new NotFoundException('Không tìm thấy học sinh');
    const grade = user.studentProfile?.gradeLevel ?? c.gradeLevel;

    const trendFrom = new Date(
      vnStartOfWeek(now).getTime() - (TREND_WEEKS - 1) * WEEK_MS,
    );
    const [stations, assignments, classFirst, recent] = await Promise.all([
      this.progression.gradeMap(
        { userId: studentId, username: user.username, role: Role.STUDENT },
        grade,
      ),
      this.assignmentModel
        .find({ classId: oid(c.id), studentIds: sid })
        .sort({ dueDate: 1 })
        .lean(),
      this.firstAttempts({
        studentId: { $in: c.studentIds.map(oid) },
        completedAt: { $gte: range.from, $lte: range.to },
      }),
      this.progressModel
        .find(
          {
            studentId: sid,
            completedAt: {
              $gte: new Date(
                Math.min(range.from.getTime(), trendFrom.getTime()),
              ),
            },
          },
          {
            quizId: 1,
            score: 1,
            passed: 1,
            completedAt: 1,
            xpEarned: 1,
            assignmentId: 1,
          },
        )
        .sort({ completedAt: -1 })
        .lean(),
    ]);

    // Homework
    const index = await this.submissions.attempts(
      assignments.map((a) => a._id),
      sid,
    );
    const quizzes = await this.submissions.quizzes([
      ...assignments.map((a) => a.quizId),
      ...recent.map((r) => r.quizId),
    ]);
    const subs: { a: AssignmentDoc; s: Submission }[] = assignments.map(
      (a) => ({
        a,
        s: this.submissions.submissions(a, index, now).get(studentId)!,
      }),
    );

    // Topics and skills: this student vs the whole class (first attempts).
    const mine = classFirst.filter((at) => at.studentId.equals(sid));
    const [myTopics, classTopics, mySkills, classSkills] = await Promise.all([
      this.tallies(mine, (q) => q.topic),
      this.tallies(classFirst, (q) => q.topic),
      this.tallies(mine, (q) => q.skill ?? QuestionSkill.VOCABULARY),
      this.tallies(classFirst, (q) => q.skill ?? QuestionSkill.VOCABULARY),
    ]);

    const inRange = recent.filter(
      (r) => r.completedAt >= range.from && r.completedAt <= range.to,
    );
    const weeks = Array.from({ length: TREND_WEEKS }, (_, i) => {
      const start = new Date(trendFrom.getTime() + i * WEEK_MS);
      const end = start.getTime() + WEEK_MS;
      const scores = recent
        .filter(
          (r) =>
            r.completedAt.getTime() >= start.getTime() &&
            r.completedAt.getTime() < end,
        )
        .map((r) => r.score);
      return {
        weekStart: start,
        averageScore: average(scores),
        attempts: scores.length,
      };
    });
    const current = stations.find((s) => s.status === 'unlocked');

    return {
      student: {
        id: studentId,
        fullName: user.fullName,
        username: user.username,
        gradeLevel: grade,
        level: user.studentProfile?.level ?? 1,
        xp: user.studentProfile?.xp ?? 0,
      },
      class: { id: c.id, name: c.name },
      range,
      xpInRange: inRange.reduce((sum, r) => sum + (r.xpEarned ?? 0), 0),
      map: {
        totalStations: stations.length,
        unlocked: stations.filter((s) => s.status !== 'locked').length,
        passed: stations.filter((s) => s.status === 'passed').length,
        current: current
          ? {
              id: current.quiz._id.toString(),
              title: current.quiz.title,
              coverEmoji: current.quiz.coverEmoji,
            }
          : null,
      },
      homework: {
        counts: countStates(subs.map((x) => x.s)),
        incomplete: subs
          .filter((x) => x.s.state === 'pending' || x.s.state === 'missing')
          .map(({ a, s }) => ({
            assignmentId: a._id.toString(),
            quizTitle:
              quizzes.get(a.quizId.toString())?.title ?? '(quiz đã xoá)',
            dueDate: a.dueDate,
            state: s.state,
          })),
      },
      topics: [...myTopics.entries()]
        .map(([topic, t]) => ({
          topic,
          correctRate: percent(t.correct, t.answered) ?? 0,
          classRate: rateOf(classTopics.get(topic)),
          answered: t.answered,
        }))
        .sort((a, b) => a.correctRate - b.correctRate),
      skills: SKILLS.filter((s) => mySkills.has(s)).map((skill) => {
        const t = mySkills.get(skill)!;
        return {
          skill,
          correctRate: percent(t.correct, t.answered) ?? 0,
          classRate: rateOf(classSkills.get(skill)),
          answered: t.answered,
        };
      }),
      weeklyTrend: weeks,
      history: inRange.slice(0, HISTORY_MAX).map((r) => {
        const q = quizzes.get(r.quizId.toString());
        return {
          attemptId: r._id.toString(),
          quizTitle: q?.title ?? '(quiz đã xoá)',
          coverEmoji: q?.coverEmoji ?? '📘',
          score: r.score,
          passed: r.passed ?? false,
          completedAt: r.completedAt,
          homework: !!r.assignmentId,
        };
      }),
    };
  }

  // ---------- D. Gradebook ----------

  async gradebook(
    c: ClassAccess,
    range: DateRange,
    now = new Date(),
  ): Promise<Gradebook> {
    const members = c.studentIds.map(oid);
    const assignments = await this.assignmentModel
      // Homework of the period: due on/after its start and given before its
      // end, so work still open at the end of the period is included.
      .find({
        classId: oid(c.id),
        dueDate: { $gte: range.from },
        createdAt: { $lte: range.to },
      })
      .sort({ dueDate: 1, _id: 1 })
      .lean();
    const [index, quizzes, students, users] = await Promise.all([
      this.submissions.attempts(assignments.map((a) => a._id)),
      this.submissions.quizzes(assignments.map((a) => a.quizId)),
      this.studentRefs(members),
      this.userModel
        .find({ _id: { $in: members } }, { studentProfile: 1 })
        .lean(),
    ]);
    const profile = new Map(
      users.map((u) => [u._id.toString(), u.studentProfile]),
    );
    const subsByAssignment = assignments.map((a) =>
      this.submissions.submissions(a, index, now),
    );

    const rows = students.map((student, i) => {
      const cells = subsByAssignment.map((subs) => {
        const s = subs.get(student.id);
        return s
          ? { state: s.state, score: s.score }
          : { state: 'not_assigned' as const, score: null };
      });
      const scores = cells
        .map((x) => x.score)
        .filter((x): x is number => x !== null);
      const avg = average(scores);
      return {
        index: i + 1,
        student,
        cells,
        averageScore: avg,
        average10: toTenScale(avg),
        onTime: cells.filter((x) => x.state === 'on_time').length,
        late: cells.filter((x) => x.state === 'late').length,
        notSubmitted: cells.filter(
          (x) => x.state === 'pending' || x.state === 'missing',
        ).length,
        level: profile.get(student.id)?.level ?? 1,
        xp: profile.get(student.id)?.xp ?? 0,
      };
    });

    return {
      class: {
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        schoolName: c.schoolName,
        teacherName: c.teacherName,
      },
      range,
      generatedAt: now,
      assignments: assignments.map((a) => ({
        id: a._id.toString(),
        title: quizzes.get(a.quizId.toString())?.title ?? '(quiz đã xoá)',
        dueDate: a.dueDate,
      })),
      rows,
      assignmentAverages: subsByAssignment.map((subs) =>
        average(
          [...subs.values()]
            .map((s) => s.score)
            .filter((x): x is number => x !== null),
        ),
      ),
    };
  }

  // ---------- Shared helpers ----------

  /** Earliest attempt per (student, quiz) among those matching `match`. */
  private firstAttempts(match: Record<string, unknown>): Promise<AttemptRow[]> {
    return this.progressModel.aggregate<AttemptRow>([
      { $match: match },
      { $sort: { completedAt: 1, _id: 1 } },
      {
        $group: {
          _id: { s: '$studentId', q: '$quizId' },
          doc: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$doc' } },
      {
        $project: {
          studentId: 1,
          quizId: 1,
          score: 1,
          completedAt: 1,
          details: 1,
        },
      },
    ]);
  }

  private async questionMeta(
    ids: Types.ObjectId[],
  ): Promise<Map<string, QuestionMeta>> {
    const rows = await this.questionModel
      .find(
        { _id: { $in: ids } },
        {
          questionText: 1,
          type: 1,
          topic: 1,
          skill: 1,
          pairs: 1,
          correctAnswer: 1,
        },
      )
      .lean();
    return new Map(rows.map((q) => [q._id.toString(), q]));
  }

  /** Answered/correct counts of every answer, grouped by `keyOf(question)`. */
  private async tallies(
    attempts: AttemptRow[],
    keyOf: (q: QuestionMeta) => string,
  ): Promise<Map<string, Tally>> {
    const ids = new Set<string>();
    for (const at of attempts) {
      for (const d of at.details) ids.add(d.questionId.toString());
    }
    const meta = await this.questionMeta([...ids].map(oid));
    const out = new Map<string, Tally>();
    for (const at of attempts) {
      for (const d of at.details) {
        const q = meta.get(d.questionId.toString());
        if (!q) continue;
        const key = keyOf(q);
        const t = out.get(key) ?? { answered: 0, correct: 0 };
        t.answered++;
        if (d.isCorrect) t.correct++;
        out.set(key, t);
      }
    }
    return out;
  }

  private async studentRefs(ids: Types.ObjectId[]): Promise<StudentRef[]> {
    const users = await this.userModel
      .find({ _id: { $in: ids } }, { fullName: 1, username: 1 })
      .lean();
    return users
      .map((u) => ({
        id: u._id.toString(),
        fullName: u.fullName,
        username: u.username,
      }))
      .sort(byName);
  }

  /** Last attempt time of each student (all time). */
  private async lastActivity(
    ids: Types.ObjectId[],
  ): Promise<Map<string, Date>> {
    const rows = await this.progressModel.aggregate<{
      _id: Types.ObjectId;
      last: Date;
    }>([
      { $match: { studentId: { $in: ids } } },
      { $group: { _id: '$studentId', last: { $max: '$completedAt' } } },
    ]);
    return new Map(rows.map((r) => [r._id.toString(), r.last]));
  }

  private classAssignments(classId: string) {
    return this.assignmentModel.find({ classId: oid(classId) }).lean();
  }
}

function rateOf(t: Tally | undefined): number | null {
  return t ? percent(t.correct, t.answered) : null;
}
