import { BadRequestException } from '@nestjs/common';
import { vnStartOfDay } from '../../common/utils/vn-time.js';
import type { DateRange } from './analytics.views.js';

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 400;
/** Topic cells with fewer answers are "not enough data". */
export const MIN_TOPIC_ANSWERS = 10;
export const ATTENTION_MAX = 5;
export const ATTENTION_LOW_SCORE = 60;
export const ATTENTION_MISSING = 2;
export const ATTENTION_IDLE_DAYS = 7;

/** Default: the last 30 days up to now (Vietnam calendar days). */
export function resolveRange(
  from?: Date,
  to?: Date,
  now = new Date(),
): DateRange {
  const end = to ?? now;
  const start =
    from ??
    vnStartOfDay(
      new Date(end.getTime() - (DEFAULT_RANGE_DAYS - 1) * 86_400_000),
    );
  if (start.getTime() >= end.getTime()) {
    throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
  }
  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    throw new BadRequestException(
      `Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày`,
    );
  }
  return { from: start, to: end };
}

export const percent = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 100);

export const average = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

/** 100-point score -> 10-point scale with one decimal (85 -> 8.5). */
export const toTenScale = (score: number | null): number | null =>
  score === null ? null : Math.round(score) / 10;

/**
 * Human-readable answer for reports. Answers are stored as given:
 * string (multiple choice / fill in), {left,right}[] (matching),
 * string[] (ordering), or null when skipped.
 */
export function formatAnswer(value: unknown): string {
  if (value === null || value === undefined) return '(bỏ trống)';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'string')) return value.join(' ');
    return value
      .map((v) =>
        typeof v === 'object' && v !== null && 'left' in v && 'right' in v
          ? `${String(v.left)} → ${String(v.right)}`
          : JSON.stringify(v),
      )
      .join(', ');
  }
  return JSON.stringify(value);
}

/** Groups equal answers (case/space-insensitive) to find the most common one. */
export function answerKey(value: unknown): string {
  return formatAnswer(value).toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Why a student needs attention (empty = fine). Each reason is a short
 * Vietnamese chip shown to the teacher.
 */
export function attentionReasons(input: {
  averageScore: number | null;
  missingCount: number;
  lastActiveAt: Date | null;
  now?: Date;
}): string[] {
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  if (input.averageScore !== null && input.averageScore < ATTENTION_LOW_SCORE) {
    reasons.push(`Điểm TB ${input.averageScore}`);
  }
  if (input.missingCount >= ATTENTION_MISSING) {
    reasons.push(`${input.missingCount} bài quá hạn chưa nộp`);
  }
  const idleMs = ATTENTION_IDLE_DAYS * 86_400_000;
  if (!input.lastActiveAt) reasons.push('Chưa làm bài nào');
  else if (now.getTime() - input.lastActiveAt.getTime() > idleMs) {
    reasons.push(`Không làm bài ${ATTENTION_IDLE_DAYS} ngày`);
  }
  return reasons;
}
