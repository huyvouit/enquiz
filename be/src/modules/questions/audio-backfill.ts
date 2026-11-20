import { ConflictException } from '@nestjs/common';
import {
  Command,
  CommandHandler,
  ICommandHandler,
  IQueryHandler,
  Query,
  QueryHandler,
} from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QuestionAudioService } from '../audio/question-audio.service.js';
import { Question } from './schemas/question.schema.js';

/**
 * Listening questions without audio yet: saved while TTS was off or failing,
 * or created before plan D16. The admin fills them in small batches.
 */
const MISSING_AUDIO = {
  audioText: { $exists: true, $nin: [null, ''] },
  audioUrl: { $exists: false },
};

/**
 * Small enough to finish well within the 60 s that Firebase Hosting waits
 * for Cloud Run; the admin repeats until `remaining` is 0.
 */
export const BACKFILL_BATCH = 25;

export interface AudioStatus {
  /** TTS_DRIVER is not `none`. */
  enabled: boolean;
  /** Listening questions still without audio. */
  missing: number;
}

export interface BackfillResult {
  generated: number;
  failed: number;
  remaining: number;
}

export class GetAudioStatusQuery extends Query<AudioStatus> {}

export class BackfillAudioCommand extends Command<BackfillResult> {}

@QueryHandler(GetAudioStatusQuery)
export class GetAudioStatusHandler implements IQueryHandler<GetAudioStatusQuery> {
  constructor(
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    private readonly audio: QuestionAudioService,
  ) {}

  async execute(): Promise<AudioStatus> {
    return {
      enabled: this.audio.enabled,
      missing: await this.questionModel.countDocuments(MISSING_AUDIO),
    };
  }
}

@CommandHandler(BackfillAudioCommand)
export class BackfillAudioHandler implements ICommandHandler<BackfillAudioCommand> {
  constructor(
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    private readonly audio: QuestionAudioService,
  ) {}

  async execute(): Promise<BackfillResult> {
    if (!this.audio.enabled) {
      throw new ConflictException(
        'Chức năng đọc thành tiếng đang tắt (TTS_DRIVER=none)',
      );
    }
    const batch = await this.questionModel
      .find(MISSING_AUDIO, { audioText: 1 })
      .sort({ _id: 1 })
      .limit(BACKFILL_BATCH)
      .lean();
    const docs = batch.map((q) => ({
      _id: q._id,
      audioText: q.audioText,
      audioUrl: undefined as string | undefined,
    }));
    await this.audio.fill(docs);

    let generated = 0;
    for (const d of docs) {
      if (!d.audioUrl) continue;
      // Only if the text is still the one the audio was made from.
      const res = await this.questionModel.updateOne(
        { _id: d._id, audioText: d.audioText },
        { $set: { audioUrl: d.audioUrl } },
      );
      generated += res.modifiedCount;
    }
    return {
      generated,
      failed: docs.length - generated,
      remaining: await this.questionModel.countDocuments(MISSING_AUDIO),
    };
  }
}
