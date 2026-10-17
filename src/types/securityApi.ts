import type {
  LoginAlertPreferences,
  PasswordSecurityInfo,
  SecurityPreferences,
  SecuritySession,
  SecurityStatus,
  TwoFactorStatus,
} from '@/types/security'
import type { ApiErrorCode, ApiFailure, ApiRateLimitedFailure, ApiSuccess, ApiVersionMismatch } from '@/types/api'

export type SecurityApiErrorCode = ApiErrorCode<
  | 'invalid_current_password'
  | 'reauthentication_required'
  | 'invalid_or_expired_two_factor_challenge'
  | 'two_factor_already_enabled'
  | 'two_factor_not_enabled'
  | 'session_not_found'
  | 'provider_unavailable'
>

export type SecurityApiFailure =
  | ApiFailure<SecurityApiErrorCode, {
    currentVersion?: string
  }>
  | ApiRateLimitedFailure

export type SecurityApiSuccess<T> = ApiSuccess<T>
export type SecurityApiResult<T> = SecurityApiSuccess<T> | SecurityApiFailure
export type SecurityPreferencesMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentPreferencesVersion'>
  | ApiFailure<Exclude<SecurityApiErrorCode, 'version_mismatch'>>
export type LoginAlertsMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentLoginAlertsVersion'>
  | ApiFailure<Exclude<SecurityApiErrorCode, 'version_mismatch'>>

/** A short-lived backend-issued proof; no password or other secret is returned in API responses. */
export type ReauthenticationProof = {
  token: string
  expiresAt: string
}

export type SecurityStatusSnapshot = {
  securityStatus: SecurityStatus
  twoFactor: TwoFactorStatus
  passwordInfo: PasswordSecurityInfo
  preferences: SecurityPreferences
  loginAlerts: LoginAlertPreferences
  preferencesVersion: string
  loginAlertsVersion: string
  checkedAt: string
}

export type GetSecurityStatusResponse = SecurityApiResult<{
  status: SecurityStatusSnapshot
}>

/** Password input exists only in the request. The response carries policy effects, never secrets. */
export type ChangePasswordRequest = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
  reauthentication?: ReauthenticationProof
  /** Backend policy decides which sessions to invalidate after success. */
  requestedSessionInvalidation?: 'other-sessions' | 'all-sessions'
}

export type ChangePasswordResponse = SecurityApiResult<{
  passwordInfo: PasswordSecurityInfo
  invalidatedSessionIds: string[]
  currentSessionRetained: boolean
}>

export type BeginTwoFactorEnrollmentRequest = {
  method: Extract<TwoFactorStatus['method'], 'authenticator'>
  reauthentication?: ReauthenticationProof
}

/** Setup material is temporary and backend-controlled; it is referenced rather than stored as frontend state. */
export type BeginTwoFactorEnrollmentResponse = SecurityApiResult<{
  enrollmentId: string
  setupReference: string
  expiresAt: string
}>

export type ConfirmTwoFactorEnrollmentRequest = {
  enrollmentId: string
  verificationCode: string
  reauthentication?: ReauthenticationProof
}

/** Recovery codes are exposed only in this successful enrollment/rotation response. */
export type ConfirmTwoFactorEnrollmentResponse = SecurityApiResult<{
  twoFactor: TwoFactorStatus
  recoveryCodes?: string[]
}>

export type DisableTwoFactorRequest = {
  reauthentication?: ReauthenticationProof
}

export type DisableTwoFactorResponse = SecurityApiResult<{
  twoFactor: TwoFactorStatus
}>

/** Device, IP and activity details are backend-authoritative. */
export type AuthoritativeSecuritySession = SecuritySession & {
  version: string
  createdAt: string
}

export type ListSecuritySessionsResponse = SecurityApiResult<{
  sessions: AuthoritativeSecuritySession[]
}>

/** Idempotency makes a retry after uncertain network delivery safe. */
export type RevokeSessionRequest = {
  sessionId: string
  expectedVersion?: string
  idempotencyKey: string
  reauthentication?: ReauthenticationProof
}

export type RevokeSessionResponse = SecurityApiResult<{
  sessionId: string
  revoked: boolean
  currentSessionRevoked: boolean
}>

/** The caller explicitly chooses whether the authenticated current session is retained or revoked. */
export type RevokeAllOtherSessionsRequest = {
  expectedSessionsVersion?: string
  idempotencyKey: string
  currentSessionBehavior: 'retain-current' | 'revoke-current'
  reauthentication?: ReauthenticationProof
}

export type RevokeAllOtherSessionsResponse = SecurityApiResult<{
  revokedSessionIds: string[]
  currentSessionRetained: boolean
}>

export type UpdateSecurityPreferencesRequest = {
  expectedVersion: string
  changes: Partial<SecurityPreferences>
}

export type UpdateSecurityPreferencesResponse = SecurityPreferencesMutationResponse<{
  preferences: SecurityPreferences
  version: string
}>

export type UpdateLoginAlertsRequest = {
  expectedVersion: string
  changes: Partial<LoginAlertPreferences>
}

export type UpdateLoginAlertsResponse = LoginAlertsMutationResponse<{
  loginAlerts: LoginAlertPreferences
  version: string
}>

/**
 * Password changes, 2FA state, and session revocations are backend-only sensitive
 * operations. The frontend must wait for these authoritative responses and never
 * simulate success. Preference mutations are versioned; session revocations are
 * both idempotent and safe to retry.
 */
export interface SecurityApiContract {
  getSecurityStatus(): Promise<GetSecurityStatusResponse>
  changePassword(input: ChangePasswordRequest): Promise<ChangePasswordResponse>
  beginTwoFactorEnrollment(input: BeginTwoFactorEnrollmentRequest): Promise<BeginTwoFactorEnrollmentResponse>
  confirmTwoFactorEnrollment(input: ConfirmTwoFactorEnrollmentRequest): Promise<ConfirmTwoFactorEnrollmentResponse>
  disableTwoFactor(input: DisableTwoFactorRequest): Promise<DisableTwoFactorResponse>
  listSessions(): Promise<ListSecuritySessionsResponse>
  revokeSession(input: RevokeSessionRequest): Promise<RevokeSessionResponse>
  revokeAllOtherSessions(input: RevokeAllOtherSessionsRequest): Promise<RevokeAllOtherSessionsResponse>
  updateSecurityPreferences(input: UpdateSecurityPreferencesRequest): Promise<UpdateSecurityPreferencesResponse>
  updateLoginAlerts(input: UpdateLoginAlertsRequest): Promise<UpdateLoginAlertsResponse>
}
