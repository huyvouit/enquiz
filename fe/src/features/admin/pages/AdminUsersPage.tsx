import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useAuthStore } from '@/features/auth'
import { errorMessage } from '@/shared/api/http'
import { Button, Card, EmptyState, ErrorBox, Input, Modal, PageHeader, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { formatDateTime } from '@/shared/lib/format'
import { adminApi, adminKeys } from '../api/admin.api'
import { Pager } from '../components/Pager'
import { RoleChip, StatusChip } from '../components/UserChips'
import type { AdminUser, TemporaryPassword, UserFilters } from '../types'

type TabId = 'pending' | 'teachers' | 'students' | 'disabled' | 'all'

const TABS: { id: TabId; label: string; filter: Pick<UserFilters, 'role' | 'status'> }[] = [
  { id: 'pending', label: '⏳ Chờ duyệt', filter: { role: 'teacher', status: 'pending' } },
  { id: 'teachers', label: '👩‍🏫 Giáo viên', filter: { role: 'teacher' } },
  { id: 'students', label: '🧒 Học sinh', filter: { role: 'student' } },
  { id: 'disabled', label: '🔒 Đã khoá', filter: { status: 'disabled' } },
  { id: 'all', label: 'Tất cả', filter: {} },
]
const PAGE_SIZE = 20
const PENDING_FILTER: UserFilters = { role: 'teacher', status: 'pending', page: 1, limit: 1 }

type Confirm = { kind: 'disable' | 'reset'; user: AdminUser } | null

/** Admin: approve teachers, lock/unlock accounts, reset passwords (plan 3.0). */
export function AdminUsersPage() {
  const me = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [chosenTab, setChosenTab] = useState<TabId | null>(null)
  const [page, setPage] = useState(1)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [password, setPassword] = useState<TemporaryPassword | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const pending = useQuery({
    queryKey: adminKeys.users(PENDING_FILTER),
    queryFn: () => adminApi.users(PENDING_FILTER),
  })
  const pendingCount = pending.data?.total
  // Open on "Chờ duyệt" when someone is waiting, otherwise on "Giáo viên".
  const tab: TabId | null =
    chosenTab ?? (pendingCount === undefined ? null : pendingCount > 0 ? 'pending' : 'teachers')

  const filters: UserFilters = {
    ...TABS.find((t) => t.id === tab)?.filter,
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
  }
  const users = useQuery({
    queryKey: adminKeys.users(filters),
    queryFn: () => adminApi.users(filters),
    enabled: tab !== null,
    placeholderData: keepPreviousData,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.allUsers })
  const setStatus = useMutation({
    mutationFn: (v: { user: AdminUser; status: 'active' | 'disabled' }) =>
      adminApi.setStatus(v.user.id, v.status),
    onSuccess: (updated, v) => {
      setNotice(
        v.status === 'disabled'
          ? `Đã khoá tài khoản ${updated.fullName}`
          : v.user.status === 'pending'
            ? `Đã duyệt ${updated.fullName}. Thầy cô bấm “Kiểm tra lại” hoặc đăng nhập lại là dùng được.`
            : `Đã mở khoá ${updated.fullName}`,
      )
      setConfirm(null)
      return refresh()
    },
  })
  const reset = useMutation({
    mutationFn: (user: AdminUser) => adminApi.resetPassword(user.id),
    onSuccess: (result) => {
      setConfirm(null)
      setPassword(result)
    },
  })
  const actionError = setStatus.error ?? reset.error

  function chooseTab(id: TabId) {
    setChosenTab(id)
    setPage(1)
    setNotice(null)
  }
  function onSearch(e: FormEvent) {
    e.preventDefault()
    setSearch(searchDraft.trim())
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        title="👥 Quản lý tài khoản"
        subtitle="Duyệt giáo viên mới, khoá tài khoản và cấp lại mật khẩu"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => chooseTab(t.id)}
            className={cn(
              'rounded-xl px-3 py-2 font-bold transition-colors',
              tab === t.id ? 'bg-brand text-white' : 'bg-surface text-ink-soft hover:text-ink',
            )}
          >
            {t.label}
            {t.id === 'pending' && pendingCount ? (
              <span className="ml-1.5 rounded-full bg-sunny px-2 text-sm text-ink">{pendingCount}</span>
            ) : null}
          </button>
        ))}
        <form onSubmit={onSearch} className="ml-auto flex gap-2">
          <Input
            type="search"
            placeholder="Tìm tên hoặc tên đăng nhập"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label="Tìm người dùng"
            className="w-56"
          />
          <Button type="submit" variant="secondary">
            Tìm
          </Button>
        </form>
      </div>

      {notice ? (
        <p role="status" className="mb-4 rounded-2xl bg-grass-soft px-4 py-3 font-bold text-green-700">
          ✅ {notice}
        </p>
      ) : null}
      {actionError ? (
        <div className="mb-4">
          <ErrorBox message={errorMessage(actionError)} />
        </div>
      ) : null}

      {users.isPending || tab === null ? (
        <Spinner />
      ) : users.isError ? (
        <ErrorBox message={errorMessage(users.error)} onRetry={() => users.refetch()} />
      ) : users.data.items.length === 0 ? (
        <EmptyState emoji={tab === 'pending' ? '🎉' : '🔍'} title={tab === 'pending' ? 'Không có giáo viên nào chờ duyệt' : 'Không có tài khoản phù hợp'} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b-2 border-line text-sm text-ink-soft">
              <tr>
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.data.items.map((u) => (
                <tr key={u.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-bold">{u.fullName}</p>
                    <p className="text-sm text-ink-soft">
                      @{u.username}
                      {u.studentProfile
                        ? ` · Lớp ${u.studentProfile.gradeLevel} · Cấp ${u.studentProfile.level}`
                        : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <RoleChip role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-soft">{formatDateTime(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      user={u}
                      isMe={u.id === me?.id}
                      busy={setStatus.isPending && setStatus.variables?.user.id === u.id}
                      onApprove={() => setStatus.mutate({ user: u, status: 'active' })}
                      onUnlock={() => setStatus.mutate({ user: u, status: 'active' })}
                      onDisable={() => setConfirm({ kind: 'disable', user: u })}
                      onReset={() => setConfirm({ kind: 'reset', user: u })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {users.data ? (
        <div className="mt-4">
          <Pager page={page} limit={PAGE_SIZE} total={users.data.total} onPage={setPage} />
        </div>
      ) : null}

      <Modal
        open={confirm !== null}
        title={confirm?.kind === 'disable' ? 'Khoá tài khoản?' : 'Đặt lại mật khẩu?'}
        onClose={() => setConfirm(null)}
      >
        {confirm ? (
          <div className="flex flex-col gap-4 font-semibold">
            <p>
              {confirm.kind === 'disable'
                ? `${confirm.user.fullName} (@${confirm.user.username}) sẽ bị đăng xuất và không đăng nhập được nữa cho đến khi được mở khoá. Dữ liệu vẫn được giữ.`
                : `Mật khẩu hiện tại của ${confirm.user.fullName} (@${confirm.user.username}) sẽ ngừng hoạt động. Mật khẩu mới chỉ hiện một lần.`}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                Huỷ
              </Button>
              <Button
                variant="danger"
                loading={setStatus.isPending || reset.isPending}
                onClick={() =>
                  confirm.kind === 'disable'
                    ? setStatus.mutate({ user: confirm.user, status: 'disabled' })
                    : reset.mutate(confirm.user)
                }
              >
                {confirm.kind === 'disable' ? '🔒 Khoá' : '🔑 Đặt lại'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <TemporaryPasswordModal value={password} onClose={() => setPassword(null)} />
    </div>
  )
}

function RowActions({
  user,
  isMe,
  busy,
  onApprove,
  onUnlock,
  onDisable,
  onReset,
}: {
  user: AdminUser
  isMe: boolean
  busy: boolean
  onApprove: () => void
  onUnlock: () => void
  onDisable: () => void
  onReset: () => void
}) {
  if (isMe || user.role === 'admin') {
    return <p className="text-right text-sm text-ink-soft">—</p>
  }
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {user.status === 'pending' ? (
        <Button size="sm" variant="success" loading={busy} onClick={onApprove}>
          ✅ Duyệt
        </Button>
      ) : null}
      {user.status === 'disabled' ? (
        <Button size="sm" variant="success" loading={busy} onClick={onUnlock}>
          🔓 Mở khoá
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={onDisable}>
          🔒 Khoá
        </Button>
      )}
      {user.status !== 'pending' ? (
        <Button size="sm" variant="secondary" onClick={onReset}>
          🔑 Mật khẩu
        </Button>
      ) : null}
    </div>
  )
}

/** Shows a freshly generated password once, with a copy button. */
function TemporaryPasswordModal({ value, onClose }: { value: TemporaryPassword | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const close = () => {
    setCopied(false)
    onClose()
  }
  return (
    <Modal open={value !== null} title="🔑 Mật khẩu mới" onClose={close}>
      {value ? (
        <div className="flex flex-col gap-4 font-semibold">
          <p>
            Mật khẩu mới của <span className="text-ink">{value.fullName}</span> (@{value.username}):
          </p>
          <div className="flex items-center gap-3">
            <code className="rounded-xl bg-sunny-soft px-4 py-2 font-display text-3xl font-extrabold tracking-wide">
              {value.temporaryPassword}
            </code>
            <Button
              variant="secondary"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(value.temporaryPassword)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false))
              }
            >
              {copied ? '✓ Đã chép' : '📋 Chép'}
            </Button>
          </div>
          <p className="text-sm text-ink-soft">
            Mật khẩu này chỉ hiện một lần và không được lưu ở dạng đọc được. Hãy gửi cho người dùng ngay.
          </p>
          <div className="flex justify-end">
            <Button onClick={close}>Xong</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
