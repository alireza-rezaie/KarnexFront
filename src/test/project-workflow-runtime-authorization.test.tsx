import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import { MembersProvider } from '@/contexts/MembersContext'
import { ProjectsProvider, useProjects } from '@/contexts/ProjectsContext'
import { TasksProvider } from '@/contexts/TasksContext'
import { WorkflowCatalogProvider, useWorkflowCatalog } from '@/contexts/WorkflowCatalogContext'

function RuntimeWrapper({ children, userId = 'm1' }: { children: ReactNode; userId?: string }) {
  return <AuthenticatedTestProvider userId={userId}>
    <MembersProvider>
      <ProjectsProvider>
        <TasksProvider>
          <WorkflowCatalogProvider>{children}</WorkflowCatalogProvider>
        </TasksProvider>
      </ProjectsProvider>
    </MembersProvider>
  </AuthenticatedTestProvider>
}

function SystemAdminWithoutProjectRoleWrapper({ children }: { children: ReactNode }) {
  const auth: AuthContextValue = {
    serviceAvailable: true, loading: false, error: null, authenticated: true,
    session: { id: 'test-session-system-admin', userId: 'm2' }, currentUserId: 'm2', currentAccount: null, isSystemAdmin: true,
    capabilities: { canLogin: false, canRegister: false, canVerifyOtp: false, canRequestPasswordReset: false, canLogout: false },
    displayCopy: { serviceUnavailable: '', actionUnavailable: '', loading: '' },
  }
  return <AuthContext.Provider value={auth}>
    <MembersProvider><ProjectsProvider><TasksProvider><WorkflowCatalogProvider>{children}</WorkflowCatalogProvider></TasksProvider></ProjectsProvider></MembersProvider>
  </AuthContext.Provider>
}

describe('project workflow runtime authority', () => {
  it('authorizes and assigns the default workflow immediately after project creation', async () => {
    const { result } = renderHook(() => ({ projects: useProjects(), catalog: useWorkflowCatalog() }), {
      wrapper: RuntimeWrapper,
    })
    let projectId = ''

    await act(async () => {
      const created = await result.current.projects.createProject?.({
        key: 'NOW', name: 'پروژهٔ فوری', description: '', type: 'scrum', status: 'active', privacy: 'private',
        icon: 'folder-kanban', color: '#3b82f6', progress: 0, members: [], startDate: '', endDate: '', tasksCount: 0, completedTasks: 0,
      })
      if (!created?.ok) throw new Error('project creation failed')
      projectId = created.project.id
      expect(await result.current.catalog.assignWorkflow(projectId, 'workflow-default')).toMatchObject({ ok: true })
    })

    expect(result.current.catalog.getAssignment(projectId).defaultWorkflowId).toBe('workflow-default')
  })

  it('requires PM/SM ownership to create a mutable workflow draft', async () => {
    const { result } = renderHook(() => useWorkflowCatalog(), {
      wrapper: ({ children }) => <RuntimeWrapper userId="m2">{children}</RuntimeWrapper>,
    })

    await act(async () => {
      expect(await result.current.createWorkflowDraft({ name: 'Draft غیرمجاز', ownerProjectId: 'p1' })).toMatchObject({ ok: false })
    })
  })

  it('keeps the owner on a draft and allows its PM to publish it', async () => {
    const { result } = renderHook(() => useWorkflowCatalog(), { wrapper: RuntimeWrapper })
    let draftId = ''

    await act(async () => {
      const created = await result.current.createWorkflowDraft({ name: 'Draft مالک', ownerProjectId: 'p1' })
      expect(created).toMatchObject({ ok: true })
      draftId = created.ok ? created.workflow!.id : ''
      expect(created.ok && created.workflow?.ownerProjectId).toBe('p1')
    })
    await act(async () => {
      expect(await result.current.publishWorkflow(draftId, {
        statuses: [{ id: 'ready', name: 'آماده', color: '#111111' }], transitions: [],
      })).toMatchObject({ ok: true })
    })
  })

  it('does not let a System Admin bypass the owning project role', async () => {
    const { result } = renderHook(() => useWorkflowCatalog(), { wrapper: SystemAdminWithoutProjectRoleWrapper })

    await act(async () => {
      expect(await result.current.createWorkflowDraft({ name: 'Draft مدیر سیستم', ownerProjectId: 'p1' })).toMatchObject({ ok: false })
    })
  })
})
