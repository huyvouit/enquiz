import type {
  SubmissionCounts,
  SubmissionState,
} from '../assignments/assignment-status.js';
import type {
  QuestionSkill,
  QuestionType,
} from '../questions/question-types.js';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface StudentRef {
  id: string;
  fullName: string;
  username: string;
}

// ---------- A. Class overview ----------

export interface AttentionItem {
  student: StudentRef;
  /** Short Vietnamese reasons shown as chips, e.g. "Điểm TB 45". */
  reasons: string[];
  averageScore: number | null;
  missingCount: number;
  lastActiveAt: Date | null;
}

export interface TopicRate {
  topic: string;
  skill: QuestionSkill;
  /** 0-100, rounded. */
  correctRate: number;
  answered: number;
}

export interface ClassOverview {
  class: { id: string; name: string; gradeLevel: number };
  range: DateRange;
  studentCount: number;
  /** Students with at least one attempt in the last 7 days. */
  activeLast7Days: number;
  /** Average score of all attempts in the range (null: none). */
  averageScore: number | null;
  attempts: number;
  /** On-time share of homework whose deadline passed within the range. */
  onTimeRate: number | null;
  openAssignments: number;
  needsAttention: AttentionItem[];
  /** Weakest topic/skill pairs (enough answers only). */
  weakTopics: TopicRate[];
}

// ---------- B1. Question heatmap ----------

/** correct / wrong / skipped in the student's first attempt; null = not played. */
export type HeatCell = 'correct' | 'wrong' | 'skipped' | null;

export interface HeatmapQuestion {
  id: string;
  /** 1-based position in the quiz (or after it when removed since). */
  index: number;
  questionText: string;
  type: QuestionType;
  topic: string;
  skill: QuestionSkill;
  /** Shown as text, e.g. "Dog" or "🐶 → dog, 🐱 → cat". */
  correctAnswer: string;
  /** false: no longer part of the quiz but present in older attempts. */
  inQuiz: boolean;
  answered: number;
  correct: number;
  /** 0-100, null when nobody answered. */
  correctRate: number | null;
  commonWrongAnswer: { answer: string; count: number } | null;
}

export interface HeatmapRow {
  student: StudentRef;
  /** Score of the first attempt (null: not played). */
  score: number | null;
  attemptId: string | null;
  cells: HeatCell[];
}

export interface QuestionHeatmap {
  className: string;
  quiz: { id: string; title: string; coverEmoji: string } | null;
  assignmentId: string | null;
  questions: HeatmapQuestion[];
  rows: HeatmapRow[];
  /** Always true: re-tries after seeing the answers would inflate the rates. */
  firstAttemptOnly: true;
}

// ---------- B2. Topic x skill heatmap ----------

export interface TopicHeatmap {
  range: DateRange;
  topics: string[];
  skills: QuestionSkill[];
  cells: TopicRate[];
  /** Cells with fewer answers are shown faded (not enough data). */
  minAnswers: number;
}

// ---------- C. Student progress report ----------

export interface StudentReport {
  student: StudentRef & { gradeLevel: number; level: number; xp: number };
  class: { id: string; name: string };
  range: DateRange;
  xpInRange: number;
  map: {
    totalStations: number;
    unlocked: number;
    passed: number;
    current: { id: string; title: string; coverEmoji: string } | null;
  };
  homework: {
    counts: SubmissionCounts;
    incomplete: {
      assignmentId: string;
      quizTitle: string;
      dueDate: Date;
      state: SubmissionState;
    }[];
  };
  topics: {
    topic: string;
    correctRate: number;
    classRate: number | null;
    answered: number;
  }[];
  skills: {
    skill: QuestionSkill;
    correctRate: number;
    classRate: number | null;
    answered: number;
  }[];
  /** Last 8 weeks (Monday-based, Vietnam time), oldest first. */
  weeklyTrend: {
    weekStart: Date;
    averageScore: number | null;
    attempts: number;
  }[];
  history: {
    attemptId: string;
    quizTitle: string;
    coverEmoji: string;
    score: number;
    passed: boolean;
    completedAt: Date;
    homework: boolean;
  }[];
}

// ---------- D. Gradebook ----------

export type GradeCellState = SubmissionState | 'not_assigned';

export interface Gradebook {
  class: {
    id: string;
    name: string;
    gradeLevel: number;
    schoolName: string | null;
    teacherName: string;
  };
  range: DateRange;
  generatedAt: Date;
  assignments: { id: string; title: string; dueDate: Date }[];
  rows: {
    index: number;
    student: StudentRef;
    cells: { state: GradeCellState; score: number | null }[];
    /** Average of submitted homework on the 100 scale (null: none). */
    averageScore: number | null;
    /** Same on the 10 scale, one decimal. */
    average10: number | null;
    onTime: number;
    late: number;
    notSubmitted: number;
    level: number;
    xp: number;
  }[];
  /** Average of each homework column (submitted only). */
  assignmentAverages: (number | null)[];
}
