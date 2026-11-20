/**
 * Published after a finished session is graded and saved, and the student's
 * level/XP updated. Subscribe here for side effects (notifications, badges,
 * realtime leaderboard) without touching the finish flow.
 */
export class QuizCompletedEvent {
  constructor(
    public readonly attemptId: string,
    public readonly studentId: string,
    public readonly quizId: string,
    public readonly score: number,
    public readonly leveledUp: boolean,
    public readonly levelAfter: number,
  ) {}
}
