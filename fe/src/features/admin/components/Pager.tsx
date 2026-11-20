import { Button } from '@/shared/components'

export function Pager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number
  limit: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 font-bold">
      <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Trước
      </Button>
      <span>
        {page} / {pages}
      </span>
      <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Sau →
      </Button>
    </div>
  )
}
