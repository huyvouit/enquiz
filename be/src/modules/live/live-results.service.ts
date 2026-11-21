import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { computeScore } from '../progress/grading/graders.js';
import { ProgressionService } from '../progress/progression/progression.service.js';
import type { AnswerDetail } from '../progress/schemas/student-progress.schema.js';
import { Quiz } from '../quizzes/schemas/quiz.schema.js';
import { activePlayers, standings } from './live-room.machine.js';
import type { LiveRoom } from './live-room.registry.js';
import { LiveMatch } from './schemas/live-match.schema.js';

/**
 * Writes a finished match (plan 5, L8, L12): the report in live_matches and,
 * for every student with an account who answered, one practice-like attempt
 * (mode 'live') through the normal progression rules (XP for beating their
 * best score, station unlock). Only revealed questions count.
 */
@Injectable()
export class LiveResultsService {
  private readonly logger = new Logger(LiveResultsService.name);

  constructor(
    @InjectModel(LiveMatch.name)
    private readonly matchModel: Model<LiveMatch>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    private readonly progression: ProgressionService,
  ) {}

  /** Starts saving once; later calls return the same promise. */
  saveOnce(room: LiveRoom, status: 'ended' | 'aborted'): Promise<void> {
    if (!room.meta.saving) {
      room.meta.saving = this.save(room, status).catch((err: unknown) => {
        this.logger.error(`Saving live match ${room.matchId}: ${String(err)}`);
      });
    }
    return room.meta.saving;
  }

  private async save(room: LiveRoom, status: 'ended' | 'aborted') {
    const s = room.state;
    const revealed = s.revealedCount;
    // Nothing was played: no report (closed lobby, stopped before a reveal).
    if (revealed === 0) return;

    const endedAt = new Date();
    const ranking = standings(s);
    const rankOf = new Map(ranking.map((r) => [r.playerId, r]));
    const players = activePlayers(s);
    const questions = s.questions.slice(0, revealed).map((q, i) => {
      const play = room.meta.playQuestions[i];
      const answers = players
        .map((p) => p.answers[i])
        .filter((a) => a !== undefined);
      const distribution = Array.from({ length: q.optionCount }, () => 0);
      for (const a of answers) distribution[a.choice]++;
      const correct = answers.filter((a) => a.isCorrect).length;
      return {
        questionId: new Types.ObjectId(q.id),
        questionText: play.questionText,
        options: play.options ?? [],
        correctIndex: q.correctIndex,
        distribution,
        answeredCount: answers.length,
        correctRate:
          players.length === 0
            ? 0
            : Math.round((correct / players.length) * 100),
        avgMs:
          answers.length === 0
            ? null
            : Math.round(
                answers.reduce((sum, a) => sum + a.elapsedMs, 0) /
                  answers.length,
              ),
      };
    });

    await this.matchModel.create({
      _id: new Types.ObjectId(room.matchId),
      hostId: new Types.ObjectId(room.hostId),
      quizId: new Types.ObjectId(room.meta.quiz.id),
      quizTitle: room.meta.quiz.title,
      coverEmoji: room.meta.quiz.coverEmoji,
      classId: room.meta.classId ? new Types.ObjectId(room.meta.classId) : null,
      className: room.meta.className,
      status,
      settings: {
        questionTimeSec: s.settings.questionTimeSec,
        allowGuests: room.meta.allowGuests,
        autoAdvanceSec: s.settings.autoAdvanceSec,
      },
      questions,
      players: players.map((p) => {
        const r = rankOf.get(p.id);
        return {
          playerId: p.id,
          userId: p.userId ? new Types.ObjectId(p.userId) : null,
          nickname: p.nickname,
          isGuest: p.isGuest,
          score: r?.score ?? 0,
          correctCount: r?.correctCount ?? 0,
          rank: r?.rank ?? players.length,
          answers: Object.entries(p.answers)
            .filter(([i]) => Number(i) < revealed)
            .map(([i, a]) => ({
              questionIndex: Number(i),
              choice: a.choice,
              isCorrect: a.isCorrect,
              ms: a.elapsedMs,
              points: a.points,
            })),
        };
      }),
      startedAt: room.meta.startedAt ? new Date(room.meta.startedAt) : null,
      endedAt,
    });

    const quiz = await this.quizModel.findById(room.meta.quiz.id).lean();
    if (!quiz) return;
    const durationSec = room.meta.startedAt
      ? Math.round((endedAt.getTime() - room.meta.startedAt) / 1000)
      : 0;
    for (const p of players) {
      if (!p.userId) continue;
      const answeredAny = Object.keys(p.answers).some(
        (i) => Number(i) < revealed,
      );
      if (!answeredAny) continue;
      const details: AnswerDetail[] = s.questions
        .slice(0, revealed)
        .map((q, i) => {
          const a = p.answers[i];
          const options = room.meta.playQuestions[i].options ?? [];
          return {
            questionId: new Types.ObjectId(q.id),
            studentAnswer: a ? (options[a.choice] ?? null) : null,
            isCorrect: a?.isCorrect ?? false,
          };
        });
      const correctCount = details.filter((d) => d.isCorrect).length;
      await this.progression.recordAttempt({
        studentId: p.userId,
        quiz,
        assignmentId: null,
        details,
        correctCount,
        score: computeScore(correctCount, revealed),
        durationSec,
        mode: 'live',
        completedAt: endedAt,
      });
    }
  }
}
