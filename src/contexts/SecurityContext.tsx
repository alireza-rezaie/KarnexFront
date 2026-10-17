import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type {
  ChangePasswordInput,
  LoginAlertPreferences,
  PasswordSecurityInfo,
  SecurityCapabilities,
  SecurityDisplayCopy,
  SecurityMutationResult,
  SecurityPreferences,
  SecuritySession,
  SecurityStatus,
  TwoFactorStatus,
} from '@/types/security'

type SecurityContextValue = {
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  securityStatus: SecurityStatus | null
  twoFactor: TwoFactorStatus | null
  passwordInfo: PasswordSecurityInfo | null
  sessions: SecuritySession[]
  preferences: SecurityPreferences | null
  loginAlerts: LoginAlertPreferences | null
  capabilities: SecurityCapabilities
  displayCopy: SecurityDisplayCopy
  enableTwoFactor?: () => Promise<SecurityMutationResult>
  disableTwoFactor?: () => Promise<SecurityMutationResult>
  changePassword?: (input: ChangePasswordInput) => Promise<SecurityMutationResult>
  revokeSession?: (sessionId: SecuritySession['id']) => Promise<SecurityMutationResult>
  revokeAllSessions?: () => Promise<SecurityMutationResult>
  updateSecurityPreferences?: (updates: Partial<SecurityPreferences>) => Promise<SecurityMutationResult>
  updateLoginAlerts?: (updates: Partial<LoginAlertPreferences>) => Promise<SecurityMutationResult>
}

const unavailableCapabilities: SecurityCapabilities = {
  canManageTwoFactor: false,
  canChangePassword: false,
  canViewSessions: false,
  canRevokeSession: false,
  canRevokeAllSessions: false,
  canManageSecurityPreferences: false,
  canManageLoginAlerts: false,
}

const unavailableCopy: SecurityDisplayCopy = {
  serviceUnavailable: 'نیازمند اتصال سرویس احراز هویت',
  securityStatusUnavailable: 'وضعیت امنیت حساب پس از اتصال سرویس احراز هویت قابل ارزیابی است.',
  twoFactorUnavailable: 'تنظیم و مدیریت تأیید دو مرحله‌ای پس از اتصال سرویس احراز هویت در دسترس خواهد بود.',
  passwordInfoUnavailable: 'اطلاعات در دسترس نیست',
  passwordChangeUnavailable: 'تغییر رمز پس از اتصال سرویس احراز هویت در دسترس خواهد بود.',
  sessionsUnavailable: 'اطلاعات نشست‌ها و دستگاه‌های فعال پس از اتصال سرویس احراز هویت نمایش داده می‌شود.',
  preferencesUnavailable: 'پس از اتصال سرویس امنیت قابل مدیریت است',
  loginAlertsUnavailable: 'پس از اتصال سرویس احراز هویت قابل مدیریت است',
}

const availableCopy: SecurityDisplayCopy = {
  serviceUnavailable: 'وضعیت سرویس امنیت در حال بررسی است.',
  securityStatusUnavailable: 'وضعیت امنیت حساب از سرویس امنیت دریافت می‌شود.',
  twoFactorUnavailable: 'وضعیت تأیید دو مرحله‌ای از سرویس احراز هویت دریافت می‌شود.',
  passwordInfoUnavailable: 'اطلاعات رمز عبور از سرویس احراز هویت دریافت می‌شود.',
  passwordChangeUnavailable: 'امکان تغییر رمز از سرویس احراز هویت دریافت می‌شود.',
  sessionsUnavailable: 'اطلاعات نشست‌ها و دستگاه‌های فعال از سرویس احراز هویت دریافت می‌شود.',
  preferencesUnavailable: 'ترجیحات امنیتی از سرویس امنیت دریافت می‌شود.',
  loginAlertsUnavailable: 'ترجیحات هشدارهای ورود از سرویس احراز هویت دریافت می‌شود.',
}

const SecurityContext = createContext<SecurityContextValue | undefined>(undefined)

export function SecurityProvider({ children }: { children: ReactNode }) {
  // The fallback intentionally exposes no security records or mutations until a backend-backed provider supplies them.
  const serviceAvailable = false
  const loading = false
  const error = null

  const value = useMemo<SecurityContextValue>(() => ({
    serviceAvailable,
    loading,
    error,
    securityStatus: null,
    twoFactor: null,
    passwordInfo: null,
    sessions: [],
    preferences: null,
    loginAlerts: null,
    capabilities: unavailableCapabilities,
    displayCopy: serviceAvailable ? availableCopy : unavailableCopy,
  }), [serviceAvailable, loading, error])

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSecurity() {
  const context = useContext(SecurityContext)

  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider.')
  }

  return context
}
