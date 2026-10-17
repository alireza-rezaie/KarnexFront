import type {
  AuthSession,
  CreateRuntimeAccountInput,
  LoginInput,
  RegisterInput,
  RuntimeAccountRole,
  RuntimeAuthAccount,
  UpdateRuntimeAccountInput,
} from '@/types/auth'
import type { Member } from '@/types/member'
import type { ApiErrorCode, ApiFailure, ApiRateLimitedFailure, ApiSuccess, IdempotentCommand } from '@/types/api'

/**
 * Stable, transport-level failures for the Auth/Member boundary.
 * These codes are intentionally independent from localized display messages.
 */
export type AuthMemberApiErrorCode = ApiErrorCode<
  | 'invalid_credentials'
  | 'duplicate_username'
  | 'duplicate_email'
  | 'inactive_account'
>

export type AuthMemberApiError =
  | ApiFailure<AuthMemberApiErrorCode, {
    fieldErrors?: Partial<Record<'firstName' | 'lastName' | 'username' | 'email' | 'phone' | 'password', string>>
  }>
  | ApiRateLimitedFailure

export type AuthMemberApiSuccess<T> = ApiSuccess<T>
export type AuthMemberApiResult<T> = AuthMemberApiSuccess<T> | AuthMemberApiError

/** Account/authentication record. Passwords are deliberately not transport responses. */
export type AuthAccount = Omit<RuntimeAuthAccount, 'password'>

/** Profile/directory record; it is separate from credentials and account-level authority. */
export type MemberProfile = Pick<Member, 'id' | 'name' | 'email' | 'jobTitle' | 'avatarId' | 'avatar' | 'status' | 'projects' | 'lastActivity'>

export type RegisterRequest = RegisterInput & IdempotentCommand
export type LoginRequest = LoginInput
export type CreateAccountRequest = CreateRuntimeAccountInput & IdempotentCommand
export type UpdateAccountRequest = UpdateRuntimeAccountInput
export type UpdateMemberProfileRequest = Partial<Pick<MemberProfile, 'name' | 'email' | 'jobTitle' | 'avatarId' | 'avatar' | 'status'>>
export type SetAccountActiveRequest = { isActive: boolean }

export type SessionIdentity = {
  session: AuthSession
  /** Must always equal member.id in successful identity responses. */
  account: AuthAccount
  member: MemberProfile
}

export type RegisterResponse = AuthMemberApiResult<SessionIdentity>
export type LoginResponse = AuthMemberApiResult<SessionIdentity>
export type CurrentSessionResponse = AuthMemberApiResult<SessionIdentity | { session: null; account: null; member: null }>
export type LogoutResponse = AuthMemberApiResult<{ session: null }>
export type AccountResponse = AuthMemberApiResult<{ account: AuthAccount; member: MemberProfile }>
export type MemberProfileResponse = AuthMemberApiResult<{ member: MemberProfile }>

/**
 * Transport boundary only. Context adapters may implement this later without
 * changing their existing runtime mutation/result contracts.
 */
export interface AuthMemberApiContract {
  register(input: RegisterRequest): Promise<RegisterResponse>
  login(input: LoginRequest): Promise<LoginResponse>
  logout(): Promise<LogoutResponse>
  getCurrentSession(): Promise<CurrentSessionResponse>
  createAccount(input: CreateAccountRequest): Promise<AccountResponse>
  updateAccount(accountId: string, input: UpdateAccountRequest): Promise<AccountResponse>
  updateMemberProfile(memberId: string, input: UpdateMemberProfileRequest): Promise<MemberProfileResponse>
  setAccountActive(accountId: string, input: SetAccountActiveRequest): Promise<AccountResponse>
}

/** Ready-to-adapt request state; no UI or networking behavior is introduced here. */
export type AuthMemberRequestState<T> = {
  data: T | null
  loading: boolean
  error: AuthMemberApiError | null
}

/** Compile-time reminder that account-level and project-level roles are distinct. */
export type AuthAccountRole = RuntimeAccountRole
