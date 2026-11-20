import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { analyticsApi } from '../api/analytics.api'
import { defaultRangeChoice, resolveRangeChoice, type RangeChoice } from '../lib/range'
import type { DateRange } from '../types'

/** Query keys of this feature (invalidate with ['analytics']). */
export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (classId: string, r: DateRange) => ['analytics', 'overview', classId, r.from, r.to] as const,
  topics: (classId: string, r: DateRange) => ['analytics', 'topics', classId, r.from, r.to] as const,
  gradebook: (classId: string, r: DateRange) => ['analytics', 'gradebook', classId, r.from, r.to] as const,
  student: (classId: string, studentId: string, r: DateRange) =>
    ['analytics', 'student', classId, studentId, r.from, r.to] as const,
  heatmap: (assignmentId: string) => ['analytics', 'heatmap', assignmentId] as const,
  assignment: (assignmentId: string) => ['analytics', 'assignment', assignmentId] as const,
}

/** The selected period and its resolved from/to (recomputed when the choice changes). */
export function useRange() {
  const [choice, setChoice] = useState<RangeChoice>(() => defaultRangeChoice())
  const range = useMemo(() => resolveRangeChoice(choice), [choice])
  return { choice, setChoice, range }
}

export const useOverview = (classId: string, range: DateRange) =>
  useQuery({ queryKey: analyticsKeys.overview(classId, range), queryFn: () => analyticsApi.overview(classId, range) })

export const useTopicHeatmap = (classId: string, range: DateRange) =>
  useQuery({ queryKey: analyticsKeys.topics(classId, range), queryFn: () => analyticsApi.topics(classId, range) })

export const useGradebook = (classId: string, range: DateRange) =>
  useQuery({ queryKey: analyticsKeys.gradebook(classId, range), queryFn: () => analyticsApi.gradebook(classId, range) })

export const useStudentReport = (classId: string, studentId: string, range: DateRange) =>
  useQuery({
    queryKey: analyticsKeys.student(classId, studentId, range),
    queryFn: () => analyticsApi.studentReport(classId, studentId, range),
  })

export const useAssignmentHeatmap = (assignmentId: string) =>
  useQuery({ queryKey: analyticsKeys.heatmap(assignmentId), queryFn: () => analyticsApi.assignmentHeatmap(assignmentId) })

export const useAssignmentDetail = (assignmentId: string) =>
  useQuery({ queryKey: analyticsKeys.assignment(assignmentId), queryFn: () => analyticsApi.assignment(assignmentId) })
