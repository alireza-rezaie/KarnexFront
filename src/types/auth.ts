export type AuthSession = {
  id: string
  userId: string
  expiresAt?: string
}

/** Account-level authority; intentionally independent from project roles. */
export type RuntimeAccountRole = 'system-admin' | 'user'

/** Memory-only account record used by the frontend runtime adapter. */
export type RuntimeAuthAccount = {
  id: string
  firstName: string
  lastName: string
  username: string
  email: string
  phone: string
  password: string
  accountRole: RuntimeAccountRole
  isActive: boolean
}

export type AuthCapabilities = {
  canLogin: boolean
  canRegister: boolean
  canVerifyOtp: boolean
  canRequestPasswordReset: boolean
  canLogout: boolean
}

export type AuthDisplayCopy = {
  serviceUnavailable: string
  actionUnavailable: string
  loading: string
}

export type AuthNextPath = '/dashboard' | '/login' | '/onboarding' | '/otp'

export type AuthMutationResult =
  | { ok: true; nextPath?: AuthNextPath }
  | { ok: false; message?: string }

export type LoginInput = {
  username: string
  password: string
  remember?: boolean
}

export type RegisterInput = {
  firstName: string
  lastName: string
  username: string
  phone: string
  email: string
  password: string
}

/** Input accepted by the system-admin account creation mutation. */
export type CreateRuntimeAccountInput = RegisterInput

export type RuntimeAccountMutationResult =
  | { ok: true; account: RuntimeAuthAccount }
  | { ok: false; message?: string }

export type UpdateRuntimeAccountInput = Pick<RuntimeAuthAccount, 'firstName' | 'lastName' | 'username' | 'email' | 'phone'>

export type VerifyOtpInput = {
  code: string
}

export type PasswordResetRequestInput = {
  identifier: string
}
