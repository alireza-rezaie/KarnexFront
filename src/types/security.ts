export type SecurityStatus = {
  state: 'secure' | 'needs-attention' | 'unknown'
  checkedAt?: string
}

export type TwoFactorStatus = {
  enabled: boolean
  method?: 'authenticator' | 'sms' | 'email'
  configuredAt?: string
}

export type PasswordSecurityInfo = {
  lastChangedAt?: string
  changeRequired?: boolean
}

export type SecuritySession = {
  id: string
  deviceLabel: string
  browser?: string
  operatingSystem?: string
  location?: string
  ipAddress?: string
  lastActiveAt: string
  isCurrent: boolean
}

export type SecurityPreferences = {
  autoLockAfterInactivity: boolean
  requireTwoFactorForAllMembers: boolean
  restrictAllowedIpAddresses: boolean
}

export type LoginAlertPreferences = {
  notifyOnNewDevice: boolean
  notifyOnFailedLogin: boolean
}

export type SecurityCapabilities = {
  canManageTwoFactor: boolean
  canChangePassword: boolean
  canViewSessions: boolean
  canRevokeSession: boolean
  canRevokeAllSessions: boolean
  canManageSecurityPreferences: boolean
  canManageLoginAlerts: boolean
}

export type SecurityDisplayCopy = {
  serviceUnavailable: string
  securityStatusUnavailable: string
  twoFactorUnavailable: string
  passwordInfoUnavailable: string
  passwordChangeUnavailable: string
  sessionsUnavailable: string
  preferencesUnavailable: string
  loginAlertsUnavailable: string
}

export type SecurityMutationResult =
  | { ok: true }
  | { ok: false; message?: string }

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
