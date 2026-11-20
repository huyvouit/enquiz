import type {
  LeaderboardPeriod,
  StationStatus,
} from '../../progression/progression.rules.js';

export interface QuestMapStation {
  id: string;
  title: string;
  description?: string;
  topic: string;
  coverEmoji: string;
  questionCount: number;
  status: StationStatus;
  bestScore: number | null;
}

export interface QuestMapView {
  gradeLevel: number;
  level: number;
  xp: number;
  passScore: number;
  stations: QuestMapStation[];
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  fullName: string;
  level: number;
  xp: number;
}

export interface LeaderboardView {
  period: LeaderboardPeriod;
  scope: 'grade' | 'class';
  gradeLevel: number;
  /** Set for scope=class. */
  classId: string | null;
  className: string | null;
  /** Start of the period (null for all time). */
  since: Date | null;
  entries: LeaderboardEntry[];
  /** The current student's row, even when outside the top list. */
  me: LeaderboardEntry | null;
}
