import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { SystemAdminRoute } from '@/App'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function SystemAdminTestProvider({ children }: { children: ReactNode }) {
  const value: AuthContextValue = {
    serviceAvailable: true,
    loading: false,
    error: null,
    authenticated: true,
    session: { id: 'test-admin-session', userId: 'admin' },
    currentUserId: 'admin',
    currentAccount: null,
    isSystemAdmin: true,
    capabilities: { canLogin: false, canRegister: false, canVerifyOtp: false, canRequestPasswordReset: false, canLogout: false },
    displayCopy: { serviceUnavailable: '', actionUnavailable: '', loading: '' },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function GuardedPlans({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/admin/plans']}><LocationProbe /><SystemAdminRoute>{children}</SystemAdminRoute></MemoryRouter>
}

afterEach(cleanup)

describe('SystemAdminRoute', () => {
  it('redirects a normal authenticated user before plans content renders', () => {
    render(<AuthenticatedTestProvider userId="m8"><GuardedPlans><h1>مدیریت پلن‌ها</h1></GuardedPlans></AuthenticatedTestProvider>)

    expect(screen.getByTestId('location').textContent).toBe('/dashboard')
    expect(screen.queryByRole('heading', { name: 'مدیریت پلن‌ها' })).toBeNull()
  })

  it('does not treat a PM/SM project role as System Admin authority', () => {
    render(<AuthenticatedTestProvider userId="m1"><GuardedPlans><h1>مدیریت پلن‌ها</h1></GuardedPlans></AuthenticatedTestProvider>)

    expect(screen.getByTestId('location').textContent).toBe('/dashboard')
    expect(screen.queryByRole('heading', { name: 'مدیریت پلن‌ها' })).toBeNull()
  })

  it('allows a System Admin to render plans content', () => {
    render(<SystemAdminTestProvider><GuardedPlans><h1>مدیریت پلن‌ها</h1></GuardedPlans></SystemAdminTestProvider>)

    expect(screen.getByTestId('location').textContent).toBe('/admin/plans')
    expect(screen.getByRole('heading', { name: 'مدیریت پلن‌ها' })).toBeTruthy()
  })
})
