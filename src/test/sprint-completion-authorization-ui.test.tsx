import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import BacklogPage from '@/pages/BacklogPage'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import { MembersProvider } from '@/contexts/MembersContext'
import { CurrentUserProvider } from '@/contexts/CurrentUserContext'
import { ProjectsProvider } from '@/contexts/ProjectsContext'
import { RolesProvider } from '@/contexts/RolesContext'
import { ApprovalRequestsProvider } from '@/contexts/ApprovalRequestsContext'
import { SprintsProvider, useSprints } from '@/contexts/SprintsContext'
import { TasksProvider, useTasks } from '@/contexts/TasksContext'
import { WorkflowCatalogProvider } from '@/contexts/WorkflowCatalogContext'
import { ProjectBoardProvider } from '@/contexts/ProjectBoardContext'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { ProjectTaskProvider } from '@/contexts/ProjectTaskContext'
import { ProjectWorkflowProvider } from '@/contexts/ProjectWorkflowContext'
import { ProjectStatusProvider } from '@/contexts/ProjectStatusContext'
import { TaskTransitionProvider } from '@/contexts/TaskTransitionContext'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const projectId = 'p1'

function RuntimeProviders({ children }: { children: ReactNode }) {
  return <AuthenticatedTestProvider userId="m2"><MembersProvider><CurrentUserProvider><ProjectsProvider><RolesProvider><SprintsProvider><TasksProvider><WorkflowCatalogProvider><ProjectBoardProvider><ApprovalRequestsProvider>{children}</ApprovalRequestsProvider></ProjectBoardProvider></WorkflowCatalogProvider></TasksProvider></SprintsProvider></RolesProvider></ProjectsProvider></CurrentUserProvider></MembersProvider></AuthenticatedTestProvider>
}

function BacklogHarness() {
  return <MemoryRouter initialEntries={[`/projects/${projectId}/backlog`]}><Routes><Route path="/projects/:projectId/backlog" element={<ProjectProvider><ProjectTaskProvider><ProjectWorkflowProvider><ProjectStatusProvider><TaskTransitionProvider><BacklogPage /></TaskTransitionProvider></ProjectStatusProvider></ProjectWorkflowProvider></ProjectTaskProvider></ProjectProvider>} /></Routes></MemoryRouter>
}

function useSprintRuntime() {
  return { sprints: useSprints(), tasks: useTasks() }
}

afterEach(cleanup)

describe('non-PM/SM Sprint completion restriction', () => {
  it('disables Complete Sprint in the Backlog UI for a normal project member', () => {
    render(<RuntimeProviders><BacklogHarness /></RuntimeProviders>)

    expect((screen.getByRole('button', { name: 'تکمیل اسپرینت' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('rejects a direct completion mutation without changing the Sprint or its tasks', async () => {
    const { result } = renderHook(() => useSprintRuntime(), { wrapper: RuntimeProviders })
    const beforeSprint = result.current.sprints.sprints.find((sprint) => sprint.id === 's1')
    const beforeTasks = result.current.tasks.tasks.filter((task) => task.sprintId === 's1').map((task) => ({ id: task.id, sprintId: task.sprintId, status: task.status }))

    await act(async () => {
      expect(await result.current.sprints.completeSprint?.(projectId, 's1', { kind: 'backlog' })).toMatchObject({ ok: false })
    })

    expect(result.current.sprints.sprints.find((sprint) => sprint.id === 's1')).toEqual(beforeSprint)
    expect(result.current.tasks.tasks.filter((task) => task.sprintId === 's1').map((task) => ({ id: task.id, sprintId: task.sprintId, status: task.status }))).toEqual(beforeTasks)
  })
})
