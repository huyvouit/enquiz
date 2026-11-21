import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Button, EmptyState } from '@/shared/components'
import { isStaleChunk, reloadNow, reloadOnce } from './chunk-reload'

/**
 * Shown instead of a blank page when a page crashes while rendering or
 * loading (launch B1). The error itself goes to the console only.
 */
export function RouteError() {
  const error = useRouteError()
  const stale = isStaleChunk(error)

  useEffect(() => {
    console.error(error)
    if (stale) reloadOnce()
  }, [error, stale])

  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <EmptyState
        emoji={notFound ? '🧭' : '🛠️'}
        title={notFound ? 'Không tìm thấy trang này' : 'Ối, trang bị lỗi rồi'}
      >
        <p>
          {stale
            ? 'EnQuiz vừa được cập nhật. Em tải lại trang nhé!'
            : 'Em thử tải lại trang, hoặc quay về trang chủ nhé.'}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button onClick={reloadNow}>🔄 Tải lại trang</Button>
          <Button variant="secondary" onClick={() => window.location.assign('/')}>
            🏠 Về trang chủ
          </Button>
        </div>
      </EmptyState>
    </main>
  )
}
