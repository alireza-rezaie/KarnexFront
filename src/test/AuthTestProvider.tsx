import type { ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'

const testCapabilities: AuthContextValue['capabilities'] = {
  canLogin: false,
  canRegister: false,
  canVerifyOtp: false,
  canRequestPasswordReset: false,
  canLogout: false,
}

const testDisplayCopy: AuthContextValue['displayCopy'] = {
  serviceUnavailable: 'سرویس احراز هویت هنوز متصل نیست.',
  actionUnavailable: 'این عملیات پس از اتصال سرویس احراز هویت در دسترس خواهد بود.',
  loading: 'در حال ارتباط با سرویس احراز هویت…',
}

/** Supplies an explicit authenticated session to tests that exercise member-owned flows. */
export function AuthenticatedTestProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const value: AuthContextValue = {
    serviceAvailable: true,
    loading: false,
    error: null,
    authenticated: true,
    session: { id: `test-session-${userId}`, userId },
    currentUserId: userId,
    currentAccount: null,
    isSystemAdmin: false,
    capabilities: testCapabilities,
    displayCopy: testDisplayCopy,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
