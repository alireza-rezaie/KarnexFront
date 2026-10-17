import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import { MembersProvider } from '@/contexts/MembersContext'
import { ProjectGuard, ProjectProvider } from '@/contexts/ProjectContext'
import { ProjectsProvider } from '@/contexts/ProjectsContext'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'

const privateProjectId = 'p1'
const publicProjectId = 'p3'

afterEach(cleanup)

function ProjectRouteHarness({ initialEntry, children, userId = 'm1', systemAdmin = false }: {
  initialEntry: string
  children?: ReactNode
  userId?: string
  systemAdmin?: boolean
}) {
  const content = children ?? <h1>محتوای پروژه</h1>
  const routes = <MemoryRouter initialEntries={[initialEntry]}>
    <Routes>
      <Route path="/projects/:projectId" element={<ProjectProvider><ProjectGuard><Outlet /></ProjectGuard></ProjectProvider>}>
        <Route index element={content} />
        <Route path="board" element={content} />
        <Route path="backlog" element={content} />
        <Route path="settings" element={content} />
      </Route>
    </Routes>
  </MemoryRouter>

  return (
    <MembersProvider><ProjectsProvider>{systemAdmin
      ? <SystemAdminTestProvider userId={userId}>{routes}</SystemAdminTestProvider>
      : <AuthenticatedTestProvider userId={userId}>{routes}</AuthenticatedTestProvider>
    }</ProjectsProvider></MembersProvider>
  )
}

function SystemAdminTestProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const value: AuthContextValue = {
    serviceAvailable: true,
    loading: false,
    error: null,
    authenticated: true,
    session: { id: `test-session-${userId}`, userId },
    currentUserId: userId,
    currentAccount: null,
    isSystemAdmin: true,
    capabilities: { canLogin: false, canRegister: false, canVerifyOtp: false, canRequestPasswordReset: false, canLogout: false },
    displayCopy: { serviceUnavailable: '', actionUnavailable: '', loading: '' },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

describe('private project guard', () => {
  it('allows a project member to open a private project', () => {
    render(<ProjectRouteHarness initialEntry={`/projects/${privateProjectId}`} />)

    expect(screen.getByRole('heading', { name: 'محتوای پروژه' })).toBeTruthy()
  })

  it('denies an authenticated non-member before project content renders', () => {
    render(<ProjectRouteHarness initialEntry={`/projects/${privateProjectId}`} userId="m4" />)

    expect(screen.getByRole('alert').textContent).toContain('دسترسی به این پروژه مجاز نیست.')
    expect(screen.queryByRole('heading', { name: 'محتوای پروژه' })).toBeNull()
  })

  it.each(['board', 'backlog', 'settings'])('denies direct private child route /%s to a non-member', (childRoute) => {
    render(<ProjectRouteHarness initialEntry={`/projects/${privateProjectId}/${childRoute}`} userId="m4" />)

    expect(screen.getByRole('alert').textContent).toContain('دسترسی به این پروژه مجاز نیست.')
  })

  it('preserves public project access for a non-member', () => {
    render(<ProjectRouteHarness initialEntry={`/projects/${publicProjectId}`} userId="m1" />)

    expect(screen.getByRole('heading', { name: 'محتوای پروژه' })).toBeTruthy()
  })

  it('preserves the invalid-project state', () => {
    render(<ProjectRouteHarness initialEntry="/projects/missing-project/board" />)

    expect(screen.getByText('پروژه پیدا نشد')).toBeTruthy()
  })

  it('does not let a global role without membership bypass private access', () => {
    render(<ProjectRouteHarness initialEntry="/projects/p4" userId="m1" />)

    expect(screen.getByRole('alert').textContent).toContain('دسترسی به این پروژه مجاز نیست.')
  })

  it('does not let a System Admin without membership bypass private access', () => {
    render(<ProjectRouteHarness initialEntry="/projects/p4" userId="m1" systemAdmin />)

    expect(screen.getByRole('alert').textContent).toContain('دسترسی به این پروژه مجاز نیست.')
  })
})
