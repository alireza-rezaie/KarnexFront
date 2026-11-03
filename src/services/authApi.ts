const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim()

// Use same-origin requests by default. Vite proxies API paths during development;
// deployments can set VITE_API_BASE_URL to the backend origin.
export const apiBaseUrl = (configuredApiUrl || '').replace(/\/$/, '')

const persistentTokenKey = 'karnex.auth.token'
const temporaryTokenKey = 'karnex.auth.session-token'

function storedAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(persistentTokenKey) ?? window.sessionStorage.getItem(temporaryTokenKey)
}

type ApiErrorBody = { message?: string; messages?: string[]; errors?: Record<string, string[]>; title?: string }

export class ApiRequestError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export async function requestApi<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const accessToken = token === undefined ? storedAccessToken() : token
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiRequestError('اتصال به سرور برقرار نشد. از روشن بودن بک‌اند مطمئن شوید.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiErrorBody | null
    throw new ApiRequestError(body?.message ?? body?.messages?.[0] ?? body?.title ?? 'درخواست ناموفق بود.', response.status)
  }
  if (response.status === 204) return undefined as T
  if (response.status === 205) return undefined as T
  return response.json() as Promise<T>
}