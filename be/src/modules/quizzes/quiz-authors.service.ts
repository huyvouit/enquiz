import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema.js';
import type { QuizAuthor } from './quizzes.mapper.js';

/** Resolves `createdBy` ids into display names with a single query. */
@Injectable()
export class QuizAuthorsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async resolve(
    ids: (Types.ObjectId | null)[],
  ): Promise<Map<string, QuizAuthor>> {
    const unique = [
      ...new Set(ids.filter((id) => id !== null).map((id) => id.toString())),
    ];
    if (unique.length === 0) return new Map();
    const users = await this.userModel
      .find({ _id: { $in: unique } }, { fullName: 1 })
      .lean();
    return new Map(
      users.map((u) => [
        u._id.toString(),
        { id: u._id.toString(), fullName: u.fullName },
      ]),
    );
  }
}
