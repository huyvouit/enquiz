import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { errorMessage } from '@/shared/api/http'
import { ErrorBox, Spinner } from '@/shared/components'

/** Spinner / error with retry / content for one TanStack query. */
export function QueryState<T>({
  query,
  children,
  label,
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
  label?: string
}) {
  if (query.isPending) return <Spinner label={label} />
  if (query.isError) return <ErrorBox message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
  return <>{children(query.data)}</>
}
