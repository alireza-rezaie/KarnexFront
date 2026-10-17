import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { projects, tasks as mockTasks } from '@/test/fixtures/mockData'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { ProjectStatusProvider, useProjectStatus } from '@/contexts/ProjectStatusContext'
import { ProjectTaskProvider, useProjectTasks } from '@/contexts/ProjectTaskContext'
import { ProjectWorkflowProvider, useProjectWorkflow } from '@/contexts/ProjectWorkflowContext'
import { ProjectsProvider } from '@/contexts/ProjectsContext'
import { TasksProvider, type CreateTaskInput } from '@/contexts/TasksContext'

function WorkflowWrapper({ children }: { children: ReactNode }) {
  return (
    <ProjectsProvider>
      <TasksProvider>
        <MemoryRouter initialEntries={[`/projects/${projects[0].id}/workflow`]}>
          <Routes>
            <Route path="/projects/:projectId/*" element={
              <ProjectProvider>
                <ProjectTaskProvider>
                  <ProjectWorkflowProvider>
                    <ProjectStatusProvider>{children}</ProjectStatusProvider>
                  </ProjectWorkflowProvider>
                </ProjectTaskProvider>
              </ProjectProvider>
            } />
          </Routes>
        </MemoryRouter>
      </TasksProvider>
    </ProjectsProvider>
  )
}

function useWorkflowHarness() {
  return {
    status: useProjectStatus(),
    workflow: useProjectWorkflow(),
    tasks: useProjectTasks(),
  }
}

describe('project status and workflow safety', () => {
  it('protects base statuses and custom statuses used by a task', () => {
    const { result } = renderHook(() => useWorkflowHarness(), { wrapper: WorkflowWrapper })
    let customStatusId = ''

    act(() => {
      expect(result.current.status.deleteStatus('done')).toBe(false)
      customStatusId = result.current.status.addStatus({ name: 'تایید مشتری', color: '#111111' }).id
    })
    act(() => {
      const input = Object.fromEntries(
        Object.entries(mockTasks[0]).filter(([key]) => key !== 'id' && key !== 'projectId'),
      ) as CreateTaskInput
      result.current.tasks.createTask({ ...input, status: customStatusId })
    })

    expect(result.current.status.deleteStatus(customStatusId)).toBe(false)
  })

  it('removes transitions for an unused deleted custom status and keeps workflow validation strict', () => {
    const { result } = renderHook(() => useWorkflowHarness(), { wrapper: WorkflowWrapper })
    let customStatusId = ''

    act(() => {
      customStatusId = result.current.status.addStatus({ name: 'آماده انتشار', color: '#222222' }).id
    })
    act(() => {
      expect(result.current.workflow.addTransition('todo', 'todo')).toBe(false)
      expect(result.current.workflow.addTransition(customStatusId, 'todo')).toBe(true)
      expect(result.current.status.deleteStatus(customStatusId)).toBe(true)
    })

    expect(result.current.workflow.transitions.some(
      (transition) => transition.from === customStatusId || transition.to === customStatusId,
    )).toBe(false)
  })

  it('publishes validated status and transition replacements through the shared contexts', () => {
    const { result } = renderHook(() => useWorkflowHarness(), { wrapper: WorkflowWrapper })
    const released = { id: 'released', name: 'منتشرشده', color: '#15803d' }
    const nextStatuses = [...result.current.status.statuses, released]
    const nextTransitions = [
      ...result.current.workflow.transitions,
      { id: 'transition-done-released', from: 'done', to: released.id },
    ]

    act(() => {
      expect(result.current.status.replaceStatuses(nextStatuses)).toBe(true)
      expect(result.current.workflow.replaceTransitions(nextTransitions)).toBe(true)
    })

    expect(result.current.status.statuses).toContainEqual(released)
    expect(result.current.workflow.transitions).toContainEqual(nextTransitions.at(-1))
  })

  it('rejects an update for a task outside the current project instead of reporting a false save', async () => {
    const { result } = renderHook(() => useWorkflowHarness(), { wrapper: WorkflowWrapper })
    const foreignTask = mockTasks.find((task) => task.projectId !== projects[0].id)!

    await expect(result.current.tasks.updateTask(foreignTask.id, { title: 'نباید تغییر کند' })).resolves.toMatchObject({ ok: false })
  })
})
