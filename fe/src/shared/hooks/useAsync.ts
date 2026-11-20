import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api/http'

interface AsyncState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  /** Runs the loader again (e.g. after a mutation). */
  reload: () => void
  /** Replaces data locally without refetching (optimistic updates). */
  setData: (updater: (prev: T | undefined) => T | undefined) => void
}

/**
 * Minimal data-loading hook. Re-runs when `deps` change and ignores
 * responses from stale runs. Swap for TanStack Query if caching is needed.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setDataState] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const runId = useRef(0)

  useEffect(() => {
    const id = ++runId.current
    setLoading(true)
    setError(null)
    loader()
      .then((result) => {
        if (id === runId.current) setDataState(result)
      })
      .catch((e: unknown) => {
        if (id === runId.current) setError(errorMessage(e))
      })
      .finally(() => {
        if (id === runId.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const setData = useCallback(
    (updater: (prev: T | undefined) => T | undefined) => setDataState(updater),
    [],
  )

  return { data, error, loading, reload, setData }
}
