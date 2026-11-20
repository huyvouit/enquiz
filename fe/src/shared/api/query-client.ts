import { QueryClient } from '@tanstack/react-query'

/**
 * One TanStack Query client for the whole app. Each feature declares its keys
 * and `invalidate…()` helpers in `hooks/queries.ts`. Exported so logout can
 * clear every cached response.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
