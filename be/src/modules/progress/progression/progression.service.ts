import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../../common/enums/role.enum.js';
import type { AuthUser } from '../../../common/types/auth-user.js';
import { assignedQuizIds, questMapFilter } from '../../quizzes/quiz-access.js';
import { Quiz } from '../../quizzes/schemas/quiz.schema.js';
import { User } from '../../users/schemas/user.schema.js';
import {
  AnswerDetail,
  StudentProgress,
} from '../schemas/student-progress.schema.js';
import {
  isPassingScore,
  levelFromPassedCount,
  type StationProgress,
  type StationStatus,
  stationStatuses,
  xpGain,
} from './progression.rules.js';

type QuizDoc = Quiz & { _id: Types.ObjectId };

/**
 * Exams never count for the quest map, XP or levels (plan E4). Homework and
 * analytics queries, on the other hand, include them.
 */
export const PRACTICE_ONLY = { mode: { $ne: 'exam' } } as const;

export interface Station {
  quiz: QuizDoc;
  status: StationStatus;
  bestScore: number | null;
}

export interface QuizRef {
  id: string;
  title: string;
  coverEmoji: string;
}

export interface Progression {
  passed: boolean;
  xpEarned: number;
  totalXp: number;
  leveledUp: boolean;
  levelAfter: number;
  /** The station this attempt just opened, if any. */
  unlockedQuiz: QuizRef | null;
}

/**
 * Owns the quest-map ordering, station locking and level/XP bookkeeping.
 * Used by the session handlers, the map query and IsQuizUnlockedQuery.
 */
@Injectable()
export class ProgressionService {
  constructor(
    @InjectModel(StudentProgress.name)
    private readonly progressModel: Model<StudentProgress>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly queryBus: QueryBus,
  ) {}

  /** Best score + passed flag per quiz for one student. */
  async stationProgress(
    studentId: string,
    quizIds?: Types.ObjectId[],
  ): Promise<Map<string, StationProgress>> {
    const match: Record<string, unknown> = {
      studentId: new Types.ObjectId(studentId),
      ...PRACTICE_ONLY,
    };
    if (quizIds) match.quizId = { $in: quizIds };
    const rows = await this.progressModel.aggregate<{
      _id: Types.ObjectId;
      bestScore: number;
      passed: boolean;
    }>([
      { $match: match },
      {
        $group: {
          _id: '$quizId',
          bestScore: { $max: '$score' },
          passed: { $max: '$passed' },
        },
      },
    ]);
    return new Map(
      rows.map((r) => [
        r._id.toString(),
        { bestScore: r.bestScore, passed: r.passed },
      ]),
    );
  }

  /**
   * The ordered stations of one grade's map with their status for `user`.
   * The map holds published system quizzes only (plan D1), in admin order.
   */
  async gradeMap(user: AuthUser, gradeLevel: number): Promise<Station[]> {
    const quizzes = await this.quizModel
      .find(questMapFilter(gradeLevel))
      .sort({ mapOrder: 1, createdAt: 1, _id: 1 })
      .lean();

    // Only students are gated; teachers/admins see every station open.
    if (user.role !== Role.STUDENT) {
      return quizzes.map((quiz) => ({
        quiz,
        status: 'unlocked',
        bestScore: null,
      }));
    }

    const progress = await this.stationProgress(
      user.userId,
      quizzes.map((q) => q._id),
    );
    const statuses = stationStatuses(
      quizzes.map((q) => q._id.toString()),
      progress,
    );
    return quizzes.map((quiz, i) => ({
      quiz,
      status: statuses[i],
      bestScore: progress.get(quiz._id.toString())?.bestScore ?? null,
    }));
  }

  async isUnlocked(
    user: AuthUser,
    quiz: { _id: Types.ObjectId; gradeLevel: number },
  ): Promise<boolean> {
    if (user.role !== Role.STUDENT) return true;
    // Homework is always playable, wherever the quiz is on the map.
    const assigned = await assignedQuizIds(this.queryBus, user);
    if (assigned.includes(quiz._id.toString())) return true;
    const map = await this.gradeMap(user, quiz.gradeLevel);
    const station = map.find((s) => s.quiz._id.equals(quiz._id));
    return !!station && station.status !== 'locked';
  }

  /**
   * Saves a finished attempt and updates the student's XP and level.
   * Returns the saved attempt and what changed for the student.
   */
  async recordAttempt(input: {
    studentId: string;
    quiz: QuizDoc;
    /** Homework this attempt belongs to (null for quest-map play). */
    assignmentId: Types.ObjectId | null;
    details: AnswerDetail[];
    correctCount: number;
    score: number;
    durationSec: number;
  }) {
    const { studentId, quiz, score } = input;
    const studentOid = new Types.ObjectId(studentId);

    const before = (await this.stationProgress(studentId, [quiz._id])).get(
      quiz._id.toString(),
    );
    const passed = isPassingScore(score);
    const leveledUp = passed && !before?.passed;
    const xpEarned = xpGain(before?.bestScore ?? null, score);

    const passedBefore = await this.progressModel.distinct('quizId', {
      studentId: studentOid,
      passed: true,
      ...PRACTICE_ONLY,
    });
    const levelAfter = levelFromPassedCount(
      passedBefore.length + (leveledUp ? 1 : 0),
    );

    const progress = await this.progressModel.create({
      studentId: studentOid,
      quizId: quiz._id,
      assignmentId: input.assignmentId,
      score,
      correctCount: input.correctCount,
      totalQuestions: input.details.length,
      passed,
      xpEarned,
      leveledUp,
      levelAfter,
      durationSec: input.durationSec,
      details: input.details,
    });

    const user = await this.userModel.findByIdAndUpdate(
      studentOid,
      {
        $inc: { 'studentProfile.xp': xpEarned },
        // $max: concurrent finishes can never lower the level.
        $max: { 'studentProfile.level': levelAfter },
      },
      { returnDocument: 'after' },
    );

    let unlockedQuiz: QuizRef | null = null;
    if (leveledUp) {
      const map = await this.gradeMap(
        { userId: studentId, username: '', role: Role.STUDENT },
        quiz.gradeLevel,
      );
      const index = map.findIndex((s) => s.quiz._id.equals(quiz._id));
      const next = map[index + 1];
      if (index >= 0 && next?.status === 'unlocked') {
        unlockedQuiz = {
          id: next.quiz._id.toString(),
          title: next.quiz.title,
          coverEmoji: next.quiz.coverEmoji,
        };
      }
    }

    const progression: Progression = {
      passed,
      xpEarned,
      totalXp: user?.studentProfile?.xp ?? xpEarned,
      leveledUp,
      levelAfter,
      unlockedQuiz,
    };
    return { progress, progression };
  }
}
