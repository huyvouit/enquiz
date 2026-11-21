import { api } from '@/shared/api/http'
import type {
  CreatedLiveMatch,
  CreateLiveMatchInput,
  LiveMatchReport,
  LiveMatchSummary,
  LivePinInfo,
} from '../types'

/** REST side of the live quiz; everything during a match goes over the socket. */
export const liveKeys = {
  all: ['live'] as const,
  matches: (classId?: string) => ['live', 'matches', classId ?? null] as const,
  report: (matchId: string) => ['live', 'report', matchId] as const,
}

export const liveApi = {
  createMatch: (input: CreateLiveMatchInput) => api.post<CreatedLiveMatch>('/live/matches', input),
  listMatches: (classId?: string) => api.get<LiveMatchSummary[]>('/live/matches', classId ? { classId } : undefined),
  /** Waits server-side for a report still being written after the podium. */
  getReport: (matchId: string) => api.get<LiveMatchReport>(`/live/matches/${matchId}`),
  /** Join screen: does the PIN exist, are guests allowed? (limited per IP) */
  checkPin: (pin: string) => api.get<LivePinInfo>(`/live/pin/${pin}`),
}
