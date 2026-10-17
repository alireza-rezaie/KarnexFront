import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiRequestError, requestApi } from '@/services/authApi'
import type { AuthCapabilities, AuthDisplayCopy, AuthMutationResult, AuthSession, CreateRuntimeAccountInput, LoginInput, PasswordResetRequestInput, RegisterInput, RuntimeAuthAccount, RuntimeAccountMutationResult, UpdateRuntimeAccountInput, VerifyOtpInput } from '@/types/auth'

type BackendUser = { email?: string; userName?: string; token?: string; displayName?: string }
type ManagedUser = { id: string; displayName: string; email: string | null; phoneNumber: string | null; userName: string | null; roles: string[]; taskCount: number; projectCount: number; isLocked: boolean }
const persistentTokenKey = 'karnex.auth.token'
const temporaryTokenKey = 'karnex.auth.session-token'
const capabilities: AuthCapabilities = { canLogin: true, canRegister: true, canVerifyOtp: false, canRequestPasswordReset: false, canLogout: true }
const displayCopy: AuthDisplayCopy = { serviceUnavailable: 'سرویس احراز هویت در دسترس نیست.', actionUnavailable: 'این عملیات در دسترس نیست.', loading: 'در حال انجام…' }

export type AuthContextValue = {
  serviceAvailable: boolean; loading: boolean; error: string | null; authenticated: boolean; session: AuthSession | null; accessToken?: string | null; currentUserId: string | null; currentAccount: RuntimeAuthAccount | null; isSystemAdmin: boolean; runtimeAccounts?: readonly RuntimeAuthAccount[]; capabilities: AuthCapabilities; displayCopy: AuthDisplayCopy
  login?: (input: LoginInput) => Promise<AuthMutationResult>; register?: (input: RegisterInput) => Promise<AuthMutationResult>; createRuntimeAccount?: (input: CreateRuntimeAccountInput) => Promise<RuntimeAccountMutationResult>; updateRuntimeAccount?: (accountId: string, input: UpdateRuntimeAccountInput) => Promise<RuntimeAccountMutationResult>; setRuntimeAccountActive?: (accountId: string, isActive: boolean) => Promise<RuntimeAccountMutationResult>; setRuntimeAccountRole?: (accountId: string, role: RuntimeAuthAccount['accountRole']) => Promise<RuntimeAccountMutationResult>; verifyOtp?: (input: VerifyOtpInput) => Promise<AuthMutationResult>; requestPasswordReset?: (input: PasswordResetRequestInput) => Promise<AuthMutationResult>; logout?: () => Promise<AuthMutationResult>
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readToken() { return localStorage.getItem(persistentTokenKey) ?? sessionStorage.getItem(temporaryTokenKey) }
function clearToken() { localStorage.removeItem(persistentTokenKey); sessionStorage.removeItem(temporaryTokenKey) }
function persistToken(token: string, remember: boolean) { clearToken(); (remember ? localStorage : sessionStorage).setItem(remember ? persistentTokenKey : temporaryTokenKey, token) }
function normalizePhoneNumber(value: string) {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  return value.trim().replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
}
function jwtClaims(token: string): Record<string, string> {
  try {
    const encoded = token.split('.')[1]
    const decoded = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent([...decoded].map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''))) as Record<string, string>
  } catch { return {} }
}
function toAccount(user: BackendUser, token: string): RuntimeAuthAccount {
  const claims = jwtClaims(token); const name = user.displayName || claims.given_name || 'کاربر'; const [firstName, ...lastName] = name.trim().split(/\s+/)
  const roles = Object.entries(claims).filter(([key]) => key.endsWith('/role') || key === 'role').map(([, value]) => value)
  return { id: claims.nameid || claims.sub || user.userName || user.email || crypto.randomUUID(), firstName: firstName || 'کاربر', lastName: lastName.join(' '), username: user.userName || user.email || claims.PhoneNumber || '', email: user.email || '', phone: claims.PhoneNumber || '', password: '', accountRole: roles.some((role) => ['admin', 'system-admin'].includes(role.toLowerCase())) ? 'system-admin' : 'user', isActive: true }
}
function fromManagedUser(user: ManagedUser): RuntimeAuthAccount {
  const [firstName, ...lastName] = user.displayName.trim().split(/\s+/)
  const isAdmin = user.roles.some((role) => role.toLowerCase() === 'admin')
  return { id: user.id, firstName: firstName || 'کاربر', lastName: lastName.join(' '), username: user.userName || user.email || user.phoneNumber || '', email: user.email || '', phone: user.phoneNumber || '', password: '', accountRole: isAdmin ? 'system-admin' : 'user', isActive: !user.isLocked }
}
function errorMessage(error: unknown) { return error instanceof ApiRequestError ? error.message : 'خطای غیرمنتظره‌ای رخ داد.' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken())
  const [currentAccount, setCurrentAccount] = useState<RuntimeAuthAccount | null>(null)
  const [managedAccounts, setManagedAccounts] = useState<RuntimeAuthAccount[]>([])
  const [loading, setLoading] = useState(Boolean(token)); const [error, setError] = useState<string | null>(null); const [serviceAvailable, setServiceAvailable] = useState(true)
  const applyUser = useCallback((user: BackendUser, accessToken: string) => { setToken(accessToken); setCurrentAccount(toAccount(user, accessToken)); setError(null) }, [])

  useEffect(() => {
    if (!token) return
    let active = true
    void requestApi<BackendUser>('/api/Account/CurrentUser', {}, token).then((user) => { if (active) applyUser(user, token) }).catch((requestError) => { if (!active) return; clearToken(); setToken(null); setCurrentAccount(null); setError(errorMessage(requestError)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [applyUser, token])
  const refreshManagedAccounts = useCallback(async () => {
    if (!token || currentAccount?.accountRole !== 'system-admin') return
    const users = await requestApi<ManagedUser[]>('/api/users', {}, token)
    setManagedAccounts(users.map(fromManagedUser))
  }, [currentAccount?.accountRole, token])
  useEffect(() => {
    void refreshManagedAccounts().catch(() => undefined)
  }, [refreshManagedAccounts])

  const authenticate = useCallback(async (path: '/api/Account/Login' | '/api/Account/Register', body: Record<string, string>, remember = false): Promise<AuthMutationResult> => {
    setLoading(true); setError(null)
    try {
      const user = await requestApi<BackendUser>(path, { method: 'POST', body: JSON.stringify(body) })
      if (!user.token) throw new ApiRequestError('پاسخ سرور توکن ورود ندارد.')
      persistToken(user.token, remember); applyUser(user, user.token); setServiceAvailable(true)
      return { ok: true, nextPath: '/dashboard' }
    } catch (requestError) {
      // Keep the button enabled after a network failure so the user can retry once
      // the backend has been started, without having to reload the page.
      const message = errorMessage(requestError); setError(message); setServiceAvailable(true); return { ok: false, message }
    } finally { setLoading(false) }
  }, [applyUser])
  const login = useCallback((input: LoginInput) => authenticate('/api/Account/Login', { phoneNumber: normalizePhoneNumber(input.username), password: input.password }, input.remember), [authenticate])
  const register = useCallback((input: RegisterInput) => authenticate('/api/Account/Register', { phoneNumber: normalizePhoneNumber(input.phone), password: input.password, displayName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim() }), [authenticate])
  const logout = useCallback(async (): Promise<AuthMutationResult> => { clearToken(); setToken(null); setCurrentAccount(null); setManagedAccounts([]); setError(null); return { ok: true, nextPath: '/login' } }, [])
  const createRuntimeAccount = useCallback(async (input: CreateRuntimeAccountInput): Promise<RuntimeAccountMutationResult> => {
    if (!token) return { ok: false, message: 'نشست معتبر نیست.' }
    try {
      const user = await requestApi<ManagedUser>('/api/users', { method: 'POST', body: JSON.stringify({ displayName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(), email: input.email.trim(), phoneNumber: normalizePhoneNumber(input.phone), password: input.password, role: 'User' }) }, token)
      const account = fromManagedUser(user)
      setManagedAccounts((current) => [...current, account])
      return { ok: true, account }
    } catch (requestError) { return { ok: false, message: errorMessage(requestError) } }
  }, [token])
  const updateRuntimeAccount = useCallback(async (accountId: string, input: UpdateRuntimeAccountInput): Promise<RuntimeAccountMutationResult> => {
    if (!token) return { ok: false, message: 'نشست معتبر نیست.' }
    try {
      const user = await requestApi<ManagedUser>(`/api/users/${encodeURIComponent(accountId)}`, { method: 'PUT', body: JSON.stringify({ displayName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(), email: input.email.trim(), phoneNumber: normalizePhoneNumber(input.phone), userName: input.username.trim() }) }, token)
      const account = fromManagedUser(user)
      setManagedAccounts((current) => current.map((item) => item.id === accountId ? account : item))
      if (currentAccount?.id === accountId) setCurrentAccount(account)
      return { ok: true, account }
    } catch (requestError) { return { ok: false, message: errorMessage(requestError) } }
  }, [currentAccount?.id, token])
  const setRuntimeAccountActive = useCallback(async (accountId: string, isActive: boolean): Promise<RuntimeAccountMutationResult> => {
    if (!token) return { ok: false, message: 'نشست معتبر نیست.' }
    try {
      const user = await requestApi<ManagedUser>(`/api/users/${encodeURIComponent(accountId)}/lock`, { method: 'PATCH', body: JSON.stringify({ isLocked: !isActive }) }, token)
      const account = fromManagedUser(user)
      setManagedAccounts((current) => current.map((item) => item.id === accountId ? account : item))
      return { ok: true, account }
    } catch (requestError) { return { ok: false, message: errorMessage(requestError) } }
  }, [token])
  const setRuntimeAccountRole = useCallback(async (accountId: string, role: RuntimeAuthAccount['accountRole']): Promise<RuntimeAccountMutationResult> => {
    if (!token) return { ok: false, message: 'نشست معتبر نیست.' }
    try {
      const user = await requestApi<ManagedUser>(`/api/users/${encodeURIComponent(accountId)}/role`, { method: 'PATCH', body: JSON.stringify({ role: role === 'system-admin' ? 'Admin' : 'User' }) }, token)
      const account = fromManagedUser(user)
      setManagedAccounts((current) => current.map((item) => item.id === accountId ? account : item))
      return { ok: true, account }
    } catch (requestError) { return { ok: false, message: errorMessage(requestError) } }
  }, [token])
  const unavailableAccountMutation = useCallback(async (): Promise<RuntimeAccountMutationResult> => ({ ok: false, message: 'این عملیات هنوز توسط API بک‌اند پشتیبانی نمی‌شود.' }), [])
  const session = useMemo<AuthSession | null>(() => token && currentAccount ? { id: `jwt-${currentAccount.id}`, userId: currentAccount.id } : null, [currentAccount, token])
  const runtimeAccounts = managedAccounts.length ? managedAccounts : currentAccount ? [currentAccount] : []
  const value = useMemo<AuthContextValue>(() => ({ serviceAvailable, loading, error, authenticated: session !== null, session, accessToken: token, currentUserId: session?.userId ?? null, currentAccount, isSystemAdmin: currentAccount?.accountRole === 'system-admin', runtimeAccounts, capabilities, displayCopy, login, register, createRuntimeAccount, updateRuntimeAccount, setRuntimeAccountActive, setRuntimeAccountRole, logout }), [createRuntimeAccount, currentAccount, error, loading, login, logout, register, runtimeAccounts, serviceAvailable, session, setRuntimeAccountActive, setRuntimeAccountRole, token, updateRuntimeAccount])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within an AuthProvider.'); return context }
