import type { AccountStatus } from '@/features/auth'
import type { Role } from '@/shared/api/types'
import { Badge } from '@/shared/components'

const ROLE: Record<Role, { label: string; tone: 'brand' | 'grape' | 'sky' }> = {
  student: { label: '🧒 Học sinh', tone: 'sky' },
  teacher: { label: '👩‍🏫 Giáo viên', tone: 'brand' },
  admin: { label: '🛡️ Quản trị', tone: 'grape' },
}

const STATUS: Record<AccountStatus, { label: string; tone: 'grass' | 'sunny' | 'coral' }> = {
  active: { label: 'Hoạt động', tone: 'grass' },
  pending: { label: 'Chờ duyệt', tone: 'sunny' },
  disabled: { label: 'Đã khoá', tone: 'coral' },
}

export function RoleChip({ role }: { role: Role }) {
  return <Badge tone={ROLE[role].tone}>{ROLE[role].label}</Badge>
}

export function StatusChip({ status }: { status: AccountStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
}
