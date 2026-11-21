import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

/**
 * Single axios instance for the whole app.
 * - Attaches the access token (token getter is wired in app/bootstrap.ts so
 *   `shared/` never imports from a feature).
 * - On a 401, renews the access token from the session cookie once and
 *   retries (plan D22); only a failed renewal logs the user out.
 * - Unwraps the backend envelope `{ success, data }` so callers get `data`.
 * - Converts every failure into an `ApiError` with a displayable message.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

export class ApiError extends Error {
  readonly status: number
  readonly errors?: string[]

  constructor(message: string, status: number, errors?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

let getToken: () => string | null = () => null
let renewToken: () => Promise<string | null> = async () => null
let onUnauthorized: () => void = () => {}

export function configureHttp(options: {
  getToken: () => string | null
  /** New access token from the session cookie; null = the session is over. */
  renewToken: () => Promise<string | null>
  onUnauthorized: () => void
}) {
  getToken = options.getToken
  renewToken = options.renewToken
  onUnauthorized = options.onUnauthorized
}

/** These answer 401 for a wrong password or a dead session: never retried. */
const NO_RETRY = /\/auth\/(login|register|refresh|logout)$/

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

interface ErrorBody {
  message?: string
  errors?: string[]
}

http.interceptors.response.use(
  (response) => {
    // Backend wraps successes as { success: true, data }.
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      response.data = response.data.data
    }
    return response
  },
  async (error: AxiosError<ErrorBody>) => {
    const status = error.response?.status ?? 0
    // Downloads ask for a Blob, so a JSON error body arrives as a Blob as well.
    const raw: unknown = error.response?.data
    if (raw instanceof Blob && error.response) {
      try {
        error.response.data = JSON.parse(await raw.text()) as ErrorBody
      } catch {
        error.response.data = {}
      }
    }
    // A 401 on an authenticated request: the 15-minute access token expired,
    // or the session was revoked. Renew once, then give up.
    const config = error.config as RetriableConfig | undefined
    if (status === 401 && config && getToken() && !NO_RETRY.test(config.url ?? '')) {
      if (config._retried) {
        onUnauthorized() // refused again with a fresh token: revoked
      } else {
        config._retried = true
        let token: string | null | undefined
        try {
          token = await renewToken()
        } catch {
          // Network trouble while renewing: report the original error, stay logged in.
          token = undefined
        }
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
          return http(config)
        }
        if (token === null) onUnauthorized()
      }
    }

    const message =
      error.response?.data?.message ??
      (status === 0
        ? 'Không kết nối được máy chủ. Em kiểm tra mạng nhé!'
        : 'Đã có lỗi xảy ra, vui lòng thử lại')
    return Promise.reject(new ApiError(message, status, error.response?.data?.errors))
  },
)

/** Typed helpers: return the unwrapped `data` directly. */
export const api = {
  get: <T>(url: string, params?: object) => http.get<T>(url, { params }).then((r) => r.data),
  /** `timeoutMs` for the few slow calls (default 15 s). */
  post: <T>(url: string, body?: unknown, timeoutMs?: number) =>
    http.post<T>(url, body, timeoutMs ? { timeout: timeoutMs } : undefined).then((r) => r.data),
  put: <T>(url: string, body?: unknown) => http.put<T>(url, body).then((r) => r.data),
  patch: <T>(url: string, body?: unknown) => http.patch<T>(url, body).then((r) => r.data),
  /** multipart/form-data upload of one file. */
  upload: <T>(url: string, field: string, file: File) => {
    const form = new FormData()
    form.append(field, file)
    return http
      .post<T>(url, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 })
      .then((r) => r.data)
  },
  delete: <T>(url: string) => http.delete<T>(url).then((r) => r.data),
}

/**
 * Downloads a generated file (Excel/PDF/CSV) with the auth header and saves it
 * under the name the server suggests in Content-Disposition.
 */
export async function downloadFile(url: string, params?: object, fallbackName = 'tai-ve'): Promise<void> {
  const response = await http.get<Blob>(url, { params, responseType: 'blob', timeout: 60_000 })
  const disposition = String(response.headers['content-disposition'] ?? '')
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName
  const href = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Đã có lỗi xảy ra'
}
