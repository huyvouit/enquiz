import type { AssignmentTargetKind, SubmissionState } from '../types'

type Tone = 'grass' | 'sunny' | 'sky' | 'coral'

/** Icon, label and colour of each submission state (same everywhere). */
export const STATE_META: Record<SubmissionState, { icon: string; label: string; tone: Tone; bar: string }> = {
  on_time: { icon: '✅', label: 'Đúng hạn', tone: 'grass', bar: 'bg-grass' },
  late: { icon: '🕒', label: 'Nộp muộn', tone: 'sunny', bar: 'bg-sunny' },
  pending: { icon: '⏳', label: 'Chưa nộp (còn hạn)', tone: 'sky', bar: 'bg-sky/40' },
  missing: { icon: '❌', label: 'Chưa nộp (quá hạn)', tone: 'coral', bar: 'bg-coral' },
}

export const STATE_ORDER: SubmissionState[] = ['on_time', 'late', 'pending', 'missing']

export function targetLabel(
  target: { kind: AssignmentTargetKind; groupName: string | null },
  assigned: number,
): string {
  if (target.kind === 'class') return 'Cả lớp'
  if (target.kind === 'group') return `Nhóm ${target.groupName ?? ''}`.trim()
  return `${assigned} học sinh`
}
