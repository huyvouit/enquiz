import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import { QuizSession } from '../../schemas/quiz-session.schema.js';

/** Loads a session owned by `user`; anything else is a 404. */
export async function loadOwnSession(
  model: Model<QuizSession>,
  sessionId: string,
  user: AuthUser,
) {
  const session = await model.findById(sessionId).lean();
  if (!session || !session.studentId.equals(new Types.ObjectId(user.userId))) {
    throw new NotFoundException(
      'Phiên chơi không tồn tại hoặc đã hết hạn, em mở lại bài nhé',
    );
  }
  return session;
}
