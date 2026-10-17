const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim()

/** The development backend listens on this URL; override it with VITE_API_BASE_URL in deployments. */
// During Vite development, use the same-origin proxy configured in vite.config.ts.
// This also avoids browser mixed-content/CORS issues when the frontend is served over HTTPS.
export const apiBaseUrl = (configuredApiUrl || (import.meta.env.DEV ? '' : 'http://localhost:21547')).replace(/\/$/, '')

type ApiErrorBody = { message?: string; messages?: string[]; errors?: Record<string, string[]>; title?: string }

export class ApiRequestError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export async function requestApi<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    })
  } catch {
    throw new ApiRequestError('اتصال به سرور برقرار نشد. از روشن بودن بک‌اند مطمئن شوید.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiErrorBody | null
    throw new ApiRequestError(body?.message ?? body?.messages?.[0] ?? body?.title ?? 'درخواست ناموفق بود.', response.status)
  }
  // DELETE endpoints commonly return 204 No Content.  Do not attempt to parse
  // such a response as JSON, otherwise a successful deletion is reported as a
  // client-side failure.
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
