import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth'
import { classesApi, type ClassUpdate, type GroupPayload } from '../api/classes.api'

/** Query keys of this feature. Other features may invalidate ['classes']. */
export const classKeys = {
  all: ['classes'] as const,
  teaching: (archived: boolean) => ['classes', 'teaching', archived] as const,
  mine: ['classes', 'mine'] as const,
  detail: (id: string) => ['classes', 'detail', id] as const,
}

/** Teacher/admin: the classes I teach (admin: all). */
export function useTeachingClasses(archived = false, enabled = true) {
  return useQuery({
    queryKey: classKeys.teaching(archived),
    queryFn: () => classesApi.listTeaching(archived),
    enabled,
  })
}

/** Student: the classes I am in (empty for other roles). */
export function useMyClasses() {
  const isStudent = useAuthStore((s) => s.user?.role === 'student')
  return useQuery({
    queryKey: classKeys.mine,
    queryFn: classesApi.listMine,
    enabled: isStudent,
  })
}

export function useClassDetail(id: string) {
  return useQuery({ queryKey: classKeys.detail(id), queryFn: () => classesApi.detail(id) })
}

/** Mutations of one class. Every success refreshes the class lists and detail. */
export function useClassMutations(id: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: classKeys.all })
  const opts = { onSuccess: refresh }
  return {
    update: useMutation({ mutationFn: (p: ClassUpdate) => classesApi.update(id, p), ...opts }),
    regenerateCode: useMutation({ mutationFn: () => classesApi.regenerateCode(id), ...opts }),
    bulkCreate: useMutation({ mutationFn: (names: string[]) => classesApi.bulkCreate(id, names), ...opts }),
    removeStudent: useMutation({ mutationFn: (studentId: string) => classesApi.removeStudent(id, studentId), ...opts }),
    resetPassword: useMutation({ mutationFn: (studentId: string) => classesApi.resetPassword(id, studentId) }),
    saveGroup: useMutation({
      mutationFn: ({ groupId, payload }: { groupId: string | null; payload: GroupPayload }) =>
        groupId ? classesApi.updateGroup(id, groupId, payload) : classesApi.createGroup(id, payload),
      ...opts,
    }),
    deleteGroup: useMutation({ mutationFn: (groupId: string) => classesApi.deleteGroup(id, groupId), ...opts }),
  }
}
