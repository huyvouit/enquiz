import { useMutation, useQuery } from '@tanstack/react-query'
import { queryClient } from '@/shared/api/query-client'
import { assignmentsApi } from '../api/assignments.api'
import type { CreateAssignmentPayload, UpdateAssignmentPayload } from '../types'

/** Query keys of this feature; everything lives under ['assignments']. */
export const assignmentKeys = {
  all: ['assignments'] as const,
  forClass: (classId: string) => ['assignments', 'class', classId] as const,
  detail: (id: string) => ['assignments', 'detail', id] as const,
  mine: ['assignments', 'mine'] as const,
  reminders: ['assignments', 'reminders'] as const,
}

/** Drops every cached homework list (after a submission, create, edit...). */
export const invalidateAssignments = () =>
  queryClient.invalidateQueries({ queryKey: assignmentKeys.all })

/** Student: reminders for the home banner and the header badge (refreshed every minute). */
export function useReminders(enabled = true) {
  return useQuery({
    queryKey: assignmentKeys.reminders,
    queryFn: assignmentsApi.reminders,
    refetchInterval: 60_000,
    enabled,
  })
}

export function useMyAssignments() {
  return useQuery({ queryKey: assignmentKeys.mine, queryFn: assignmentsApi.mine })
}

export function useClassAssignments(classId: string) {
  return useQuery({
    queryKey: assignmentKeys.forClass(classId),
    queryFn: () => assignmentsApi.listForClass(classId),
  })
}

export function useAssignmentDetail(id: string) {
  return useQuery({ queryKey: assignmentKeys.detail(id), queryFn: () => assignmentsApi.detail(id) })
}

export function useCreateAssignment() {
  return useMutation({
    mutationFn: ({ classId, payload }: { classId: string; payload: CreateAssignmentPayload }) =>
      assignmentsApi.create(classId, payload),
    onSuccess: () => invalidateAssignments(),
  })
}

export function useUpdateAssignment() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAssignmentPayload }) =>
      assignmentsApi.update(id, payload),
    onSuccess: () => invalidateAssignments(),
  })
}

export function useDeleteAssignment() {
  return useMutation({
    mutationFn: (id: string) => assignmentsApi.remove(id),
    onSuccess: () => invalidateAssignments(),
  })
}
