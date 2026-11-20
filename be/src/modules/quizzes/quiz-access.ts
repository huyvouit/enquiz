import { NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { QueryFilter, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { AssignedQuizIdsQuery } from '../assignments/queries/impl/assignment.queries.js';
import { Quiz, QuizStatus } from './schemas/quiz.schema.js';

/**
 * Visibility rules (phase 3, plan D1/D2):
 * - admin:   everything
 * - teacher: own quizzes (drafts too) + every published quiz
 *            ("published" on a teacher quiz = shared with other teachers)
 * - student: the quest map (published system quizzes, createdBy = null)
 *            + quizzes given to them as homework
 */
export function visibleQuizzesFilter(
  user: AuthUser,
  assignedQuizIds: string[] = [],
): QueryFilter<Quiz> {
  if (user.role === Role.ADMIN) return {};
  if (user.role === Role.TEACHER) {
    return {
      $or: [
        { status: QuizStatus.PUBLISHED },
        { createdBy: new Types.ObjectId(user.userId) },
      ],
    };
  }
  return {
    $or: [
      { createdBy: null, status: QuizStatus.PUBLISHED },
      { _id: { $in: assignedQuizIds.map((id) => new Types.ObjectId(id)) } },
    ],
  };
}

/** The stations of a grade's quest map: published system quizzes. */
export function questMapFilter(gradeLevel: number): QueryFilter<Quiz> {
  return { createdBy: null, status: QuizStatus.PUBLISHED, gradeLevel };
}

export function canSeeQuiz(
  user: AuthUser,
  quiz: Pick<Quiz, 'status' | 'createdBy'> & { _id?: Types.ObjectId },
  assignedQuizIds: string[] = [],
): boolean {
  if (user.role === Role.ADMIN) return true;
  if (user.role === Role.TEACHER) {
    return (
      quiz.status === QuizStatus.PUBLISHED ||
      quiz.createdBy?.toString() === user.userId
    );
  }
  const onMap = quiz.createdBy === null && quiz.status === QuizStatus.PUBLISHED;
  return onMap || (!!quiz._id && assignedQuizIds.includes(quiz._id.toString()));
}

/** 404 rather than 403 so drafts are not discoverable by id. */
export function assertCanSeeQuiz<
  T extends Pick<Quiz, 'status' | 'createdBy'> & { _id?: Types.ObjectId },
>(
  user: AuthUser,
  quiz: T | null,
  assignedQuizIds: string[] = [],
): asserts quiz is T {
  if (!quiz || !canSeeQuiz(user, quiz, assignedQuizIds)) {
    throw new NotFoundException('Không tìm thấy bài quiz');
  }
}

/** Homework quizzes of a student (empty for other roles). */
export function assignedQuizIds(
  queryBus: QueryBus,
  user: AuthUser,
): Promise<string[]> {
  if (user.role !== Role.STUDENT) return Promise.resolve([]);
  return queryBus.execute(new AssignedQuizIdsQuery(user.userId));
}
