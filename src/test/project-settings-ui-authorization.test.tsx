import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useContext, useState, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import { MembersProvider } from '@/contexts/MembersContext'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { ProjectsContext, ProjectsProvider, useProjects } from '@/contexts/ProjectsContext'
import { ProjectWorkflowProvider } from '@/contexts/ProjectWorkflowContext'
import { RolesProvider } from '@/contexts/RolesContext'
import { TasksProvider } from '@/contexts/TasksContext'
import { WorkflowCatalogProvider } from '@/contexts/WorkflowCatalogContext'
import ProjectSettingsPage from '@/pages/ProjectSettingsPage'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'

const projectId = 'p1'

function projectNameInput() {
  const input = document.querySelector<HTMLInputElement>('input[name="name"]')
  if (!input) throw new Error('Project name input was not rendered.')
  return input
}

function ProjectRoleOverride({ children, memberId, roleId }: { children: ReactNode; memberId?: string; roleId?: string }) {
  const context = useContext(ProjectsContext)
  if (!context || !memberId || !roleId) return <>{children}</>

  return <ProjectsContext.Provider value={{
    ...context,
    projects: context.projects.map((project) => project.id === projectId
      ? { ...project, memberRoles: { ...project.memberRoles, [memberId]: roleId } }
      : project),
  }}>{children}</ProjectsContext.Provider>
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

function SettingsHarness({ userId, routeProjectId = projectId, roleOverride, systemAdmin = false }: {
  userId: string
  routeProjectId?: string
  roleOverride?: string
  systemAdmin?: boolean
}) {
  const routes = <ProjectRoleOverride memberId={userId} roleId={roleOverride}>
    <MemoryRouter initialEntries={[`/projects/${routeProjectId}/settings`]}>
      <Routes>
        <Route path="/projects/:projectId/*" element={<ProjectProvider><ProjectWorkflowProvider><ProjectSettingsPage /></ProjectWorkflowProvider></ProjectProvider>} />
      </Routes>
    </MemoryRouter>
  </ProjectRoleOverride>

  const content = <MembersProvider><ProjectsProvider><RolesProvider><TasksProvider><WorkflowCatalogProvider>{routes}</WorkflowCatalogProvider></TasksProvider></RolesProvider></ProjectsProvider></MembersProvider>

  return systemAdmin
    ? <SystemAdminTestProvider userId={userId}>{content}</SystemAdminTestProvider>
    : <AuthenticatedTestProvider userId={userId}>{content}</AuthenticatedTestProvider>
}

function UnauthorizedUpdateProbe() {
  const { projects, updateProject } = useProjects()
  const [result, setResult] = useState('')
  const project = projects.find((item) => item.id === projectId)

  return <>
    <button onClick={() => void (async () => {
      const mutation = await updateProject?.(projectId, { name: 'نباید تغییر کند' })
      setResult(mutation?.ok ? 'ok' : 'rejected')
    })()}>mutation مستقیم</button>
    <output data-testid="project-name">{project?.name}</output>
    <output data-testid="mutation-result">{result}</output>
  </>
}

afterEach(cleanup)

describe('project settings UI authorization', () => {
  it('lets a project PM edit, save, and delete', () => {
    render(<SettingsHarness userId="m1" />)

    expect(projectNameInput().disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'ذخیره' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'حذف پروژه' })).toBeTruthy()
  })

  it('lets a project SM edit, save, and delete', () => {
    render(<SettingsHarness userId="m2" roleOverride="sm" />)

    expect(projectNameInput().disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'ذخیره' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'حذف پروژه' })).toBeTruthy()
  })

  it('renders general settings as read-only for a normal project member', () => {
    render(<SettingsHarness userId="m2" />)

    expect(projectNameInput().disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'ذخیره' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'حذف پروژه' })).toBeNull()
    expect(screen.getByText('تنظیمات پروژه فقط برای مدیر پروژه یا اسکرام‌مسترِ عضو پروژه قابل ویرایش است.')).toBeTruthy()
  })

  it('does not give a System Admin without a project role a settings bypass', () => {
    render(<SettingsHarness userId="m1" routeProjectId="p4" systemAdmin />)

    expect(projectNameInput().disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'ذخیره' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'حذف پروژه' })).toBeNull()
  })

  it('keeps the ProjectsContext rejection in force for a direct normal-member mutation', async () => {
    render(<AuthenticatedTestProvider userId="m2"><MembersProvider><ProjectsProvider><UnauthorizedUpdateProbe /></ProjectsProvider></MembersProvider></AuthenticatedTestProvider>)
    const originalName = screen.getByTestId('project-name').textContent

    fireEvent.click(screen.getByRole('button', { name: 'mutation مستقیم' }))

    await waitFor(() => expect(screen.getByTestId('mutation-result').textContent).toBe('rejected'))
    expect(screen.getByTestId('project-name').textContent).toBe(originalName)
  })
})
