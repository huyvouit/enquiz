import { QueryClient } from '@tanstack/react-query'

/**
 * One TanStack Query client for the app (phase 3 screens; older screens still
 * use `useAsync`). Exported so logout can clear every cached response.
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
