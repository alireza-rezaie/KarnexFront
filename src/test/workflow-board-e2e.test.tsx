import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import { ApprovalRequestsProvider, useApprovalRequests } from '@/contexts/ApprovalRequestsContext'
import { MembersProvider } from '@/contexts/MembersContext'
import { ProjectBoardProvider, useProjectBoard } from '@/contexts/ProjectBoardContext'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { ProjectStatusProvider } from '@/contexts/ProjectStatusContext'
import { ProjectTaskProvider, useProjectTasks } from '@/contexts/ProjectTaskContext'
import { ProjectWorkflowProvider } from '@/contexts/ProjectWorkflowContext'
import { ProjectsProvider } from '@/contexts/ProjectsContext'
import { RolesProvider } from '@/contexts/RolesContext'
import { TaskTransitionProvider, useTaskTransitions } from '@/contexts/TaskTransitionContext'
import { TasksProvider, useTasks } from '@/contexts/TasksContext'
import { WorkflowCatalogProvider, useWorkflowCatalog } from '@/contexts/WorkflowCatalogContext'
import { projects } from '@/test/fixtures/mockData'
import { getBoardStatusTargets, executeBoardTransitionById, resolveBoardStatusTarget } from '@/utils/boardTransition'
import { resolveTaskBoardColumn } from '@/types/board'

const projectId = projects[0]!.id

function Wrapper({ children }: { children: ReactNode }) {
  return <AuthenticatedTestProvider userId="m1"><MembersProvider><RolesProvider><ProjectsProvider><TasksProvider><WorkflowCatalogProvider><ProjectBoardProvider><ApprovalRequestsProvider>
    <MemoryRouter initialEntries={[`/projects/${projectId}/board`]}><Routes><Route path="/projects/:projectId/*" element={
      <ProjectProvider><ProjectTaskProvider><ProjectWorkflowProvider><ProjectStatusProvider><TaskTransitionProvider>{children}</TaskTransitionProvider></ProjectStatusProvider></ProjectWorkflowProvider></ProjectTaskProvider></ProjectProvider>
    } /></Routes></MemoryRouter>
  </ApprovalRequestsProvider></ProjectBoardProvider></WorkflowCatalogProvider></TasksProvider></ProjectsProvider></RolesProvider></MembersProvider></AuthenticatedTestProvider>
}

function useRuntime() {
  return {
    approval: useApprovalRequests(),
    board: useProjectBoard(),
    catalog: useWorkflowCatalog(),
    projectTasks: useProjectTasks(),
    tasks: useTasks(),
    transitions: useTaskTransitions(),
  }
}

describe('published workflow to Board transition acceptance chain', () => {
  it('keeps a draft transition out of Board runtime until publish, then executes its exact id through the central executor', async () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.projectTasks.tasks.find((item) => item.status === 'todo')!
    const active = result.current.catalog.getActiveWorkflow(projectId)!
    const columns = result.current.board.resolveColumns(projectId, active.statuses)
    const draftTransition = { id: 'todo-review-published-only', from: 'todo', to: 'review' }

    expect(resolveTaskBoardColumn(columns, task.status)?.statusIds).toEqual(['todo'])
    const beforePublish = result.current.transitions.getTaskTransitions({ projectId, taskId: task.id })
    if (!beforePublish.ok) throw new Error('published workflow was not resolved')
    expect(beforePublish.transitions.some((transition) => transition.id === draftTransition.id)).toBe(false)
    expect(resolveBoardStatusTarget(task.status, 'review', beforePublish.transitions)).toEqual({ kind: 'no-matching-transition' })
    expect(result.current.tasks.tasks.find((item) => item.id === task.id)?.status).toBe('todo')

    await act(async () => {
      await result.current.catalog.publishWorkflow(active.workflowId, {
        statuses: active.statuses,
        transitions: [...active.transitions, draftTransition],
      })
    })

    const afterPublish = result.current.transitions.getTaskTransitions({ projectId, taskId: task.id })
    if (!afterPublish.ok) throw new Error('new published workflow was not resolved')
    expect(resolveBoardStatusTarget(task.status, 'review', afterPublish.transitions)).toEqual({ kind: 'ready', transitionId: draftTransition.id })
    let execution
    await act(async () => {
      execution = await executeBoardTransitionById({ projectId, taskId: task.id, transitionId: draftTransition.id, transitionTask: result.current.transitions.transitionTask })
    })
    expect(execution).toMatchObject({ ok: true, code: 'transitioned', transition: { id: draftTransition.id } })
    expect(result.current.tasks.tasks.find((item) => item.id === task.id)?.status).toBe('review')
    expect(resolveTaskBoardColumn(result.current.board.resolveColumns(projectId, result.current.catalog.getActiveWorkflow(projectId)!.statuses), 'review')?.statusIds).toEqual(['review'])
  })

  it('uses status-specific targets for a grouped column and leaves exact same-status drops as no-ops', async () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.projectTasks.tasks.find((item) => item.status === 'todo')!
    const active = result.current.catalog.getActiveWorkflow(projectId)!
    await act(async () => {
      await result.current.board.updateBoardConfiguration(projectId, [
        { id: 'todo', name: 'برای انجام', order: 0, statusIds: ['todo'] },
        { id: 'active', name: 'جریان', order: 1, statusIds: ['inprogress', 'review'] },
        { id: 'done', name: 'انجام', order: 2, statusIds: ['done'] },
      ], active.statuses)
    })

    const resolution = result.current.transitions.getTaskTransitions({ projectId, taskId: task.id })
    if (!resolution.ok) throw new Error('active transitions were not resolved')
    expect(getBoardStatusTargets(task.status, ['inprogress', 'review'], resolution.transitions)).toEqual([
      { statusId: 'inprogress', current: false, reachable: true },
      { statusId: 'review', current: false, reachable: false },
    ])
    expect(resolveBoardStatusTarget(task.status, task.status, resolution.transitions)).toEqual({ kind: 'same-status-noop' })

    const target = resolveBoardStatusTarget(task.status, 'inprogress', resolution.transitions)
    if (target.kind !== 'ready') throw new Error('reachable target was not resolved')
    await act(async () => {
      expect(await executeBoardTransitionById({ projectId, taskId: task.id, transitionId: target.transitionId, transitionTask: result.current.transitions.transitionTask })).toMatchObject({ ok: true, transition: { id: target.transitionId } })
    })
    expect(result.current.tasks.tasks.find((item) => item.id === task.id)?.status).toBe('inprogress')
    expect(resolveTaskBoardColumn(result.current.board.resolveColumns(projectId, active.statuses), 'inprogress')?.id).toBe('active')
  })
})
