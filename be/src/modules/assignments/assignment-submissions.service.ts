import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FinalizeExpiredExamsCommand } from '../exams/commands/impl/exam.commands.js';
import { StudentProgress } from '../progress/schemas/student-progress.schema.js';
import { Quiz } from '../quizzes/schemas/quiz.schema.js';
import {
  averageScore,
  countStates,
  type AttemptLite,
  type Submission,
  submissionOf,
} from './assignment-status.js';
import {
  AssignmentDoc,
  AssignmentView,
  examSettingsOf,
  QuizDoc,
  toQuizRef,
} from './assignments.mapper.js';

/** attempts[assignmentId][studentId] */
export type AttemptIndex = Map<string, Map<string, AttemptLite[]>>;

/**
 * Reads homework attempts from student_progress and turns them into
 * submission states. Shared by the assignment views and the analytics module.
 */
@Injectable()
export class AssignmentSubmissionsService {
  constructor(
    @InjectModel(StudentProgress.name)
    private readonly progressModel: Model<StudentProgress>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    private readonly commandBus: CommandBus,
  ) {}

  async attempts(
    assignmentIds: Types.ObjectId[],
    studentId?: Types.ObjectId,
  ): Promise<AttemptIndex> {
    const index: AttemptIndex = new Map();
    if (assignmentIds.length === 0) return index;
    // Exams past their deadline become submissions before anything is read.
    await this.closeExpiredExams();
    const rows = await this.progressModel
      .find(
        {
          assignmentId: { $in: assignmentIds },
          ...(studentId ? { studentId } : {}),
        },
        {
          assignmentId: 1,
          studentId: 1,
          score: 1,
          completedAt: 1,
          isAutoSubmit: 1,
        },
      )
      .lean();
    for (const r of rows) {
      const aKey = r.assignmentId!.toString();
      const byStudent = index.get(aKey) ?? new Map<string, AttemptLite[]>();
      const sKey = r.studentId.toString();
      byStudent.set(sKey, [
        ...(byStudent.get(sKey) ?? []),
        {
          id: r._id.toString(),
          score: r.score,
          completedAt: r.completedAt,
          isAutoSubmit: r.isAutoSubmit ?? false,
        },
      ]);
      index.set(aKey, byStudent);
    }
    return index;
  }

  /** Plan E5: awaited command, no background job (D13). */
  closeExpiredExams(studentId?: string): Promise<number> {
    return this.commandBus.execute(
      new FinalizeExpiredExamsCommand(studentId ? { studentId } : {}),
    );
  }

  /** Submission of every assigned student, in assignment.studentIds order. */
  submissions(
    a: AssignmentDoc,
    index: AttemptIndex,
    now = new Date(),
  ): Map<string, Submission> {
    const byStudent = index.get(a._id.toString());
    return new Map(
      a.studentIds.map((sid) => [
        sid.toString(),
        submissionOf(a.dueDate, byStudent?.get(sid.toString()) ?? [], now),
      ]),
    );
  }

  async quizzes(ids: Types.ObjectId[]): Promise<Map<string, QuizDoc>> {
    const quizzes = await this.quizModel
      .find(
        { _id: { $in: ids } },
        {
          title: 1,
          coverEmoji: 1,
          topic: 1,
          gradeLevel: 1,
          questionIds: 1,
        },
      )
      .lean();
    return new Map(quizzes.map((q) => [q._id.toString(), q]));
  }

  /** Teacher list rows with counts, for many assignments at once. */
  async views(assignments: AssignmentDoc[]): Promise<AssignmentView[]> {
    const [index, quizzes] = await Promise.all([
      this.attempts(assignments.map((a) => a._id)),
      this.quizzes(assignments.map((a) => a.quizId)),
    ]);
    return assignments.map((a) => {
      const subs = [...this.submissions(a, index).values()];
      return {
        id: a._id.toString(),
        classId: a.classId.toString(),
        quiz: toQuizRef(quizzes.get(a.quizId.toString())),
        target: { kind: a.target.kind, groupName: a.target.groupName ?? null },
        ...examSettingsOf(a),
        dueDate: a.dueDate,
        status: a.status,
        note: a.note ?? null,
        createdAt: a.createdAt,
        counts: countStates(subs),
        averageScore: averageScore(subs),
      };
    });
  }
}
