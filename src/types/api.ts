/**
 * Shared transport semantics for every protected frontend API contract.
 * `unauthorized` means that no valid authenticated session exists; `forbidden`
 * means that an authenticated caller lacks authority for the requested action.
 */
export type ApiAuthorizationErrorCode = 'unauthorized' | 'forbidden'

export type ApiStandardErrorCode =
  | ApiAuthorizationErrorCode
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'version_mismatch'

export type ApiErrorCode<DomainCode extends string = never> = ApiStandardErrorCode | DomainCode

/**
 * Required only for durable commands that may be retried after an unknown
 * network outcome. Repeating the same command scope and key returns its first
 * authoritative result instead of performing the side effect twice.
 */
export type IdempotentCommand = {
  idempotencyKey: string
}

export type ApiFailure<Code extends string, Details extends object = Record<never, never>> = {
  ok: false
  code: Code
  message?: string
} & Details

/** A stale versioned write must identify the exact authoritative version to refresh. */
export type ApiVersionMismatch<VersionField extends string> = ApiFailure<'version_mismatch', Record<VersionField, string>>

/** Security-sensitive endpoints may be throttled by the server. */
export type ApiRateLimitedFailure = ApiFailure<'rate_limited', {
  retryAfterSeconds: number
}>

export type ApiSuccess<T> = { ok: true } & T
export type ApiResult<T, Code extends string, Details extends object = Record<never, never>> =
  | ApiSuccess<T>
  | ApiFailure<Code, Details>
