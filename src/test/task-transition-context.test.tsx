import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import { ApprovalRequestsProvider, useApprovalRequests } from '@/contexts/ApprovalRequestsContext'
import { MembersProvider } from '@/contexts/MembersContext'
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
import type { WorkflowTransition } from '@/types/workflow'
import type { ApprovalCreateMutationResult } from '@/types/approvalRequest'

const projectId = projects[0]!.id

function Wrapper({ children }: { children: ReactNode }) {
  return <AuthenticatedTestProvider userId="m1"><MembersProvider><RolesProvider><ProjectsProvider><TasksProvider><WorkflowCatalogProvider><ApprovalRequestsProvider>
    <MemoryRouter initialEntries={[`/projects/${projectId}/board`]}><Routes><Route path="/projects/:projectId/*" element={
      <ProjectProvider><ProjectTaskProvider><ProjectWorkflowProvider><ProjectStatusProvider><TaskTransitionProvider>{children}</TaskTransitionProvider></ProjectStatusProvider></ProjectWorkflowProvider></ProjectTaskProvider></ProjectProvider>
    } /></Routes></MemoryRouter>
  </ApprovalRequestsProvider></WorkflowCatalogProvider></TasksProvider></ProjectsProvider></RolesProvider></MembersProvider></AuthenticatedTestProvider>
}

function useRuntime() {
  return {
    transitions: useTaskTransitions(),
    catalog: useWorkflowCatalog(),
    approval: useApprovalRequests(),
    projectTasks: useProjectTasks(),
    allTasks: useTasks(),
  }
}

async function publishPolicyTransition(runtime: ReturnType<typeof useRuntime>, transition: WorkflowTransition) {
  const active = runtime.catalog.getActiveWorkflow(projectId)!
  return runtime.catalog.publishWorkflow(active.workflowId, {
    statuses: active.statuses,
    transitions: [...active.transitions, transition],
  })
}

describe('task transition execution boundary', () => {
  it('executes a valid published transition through ProjectTaskContext and preserves transition identity', async () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.projectTasks.tasks.find((candidate) => candidate.status === 'todo')!
    const resolved = result.current.transitions.getTaskTransitions({ projectId, taskId: task.id })
    if (!resolved.ok) throw new Error('active transition resolution failed')
    const transition = resolved.transitions.find((candidate) => candidate.to === 'inprogress')!
    let execution

    await act(async () => {
      execution = await result.current.transitions.transitionTask({ projectId, taskId: task.id, transitionId: transition.id })
    })

    expect(execution).toMatchObject({ ok: true, code: 'transitioned', transition: { id: transition.id, from: 'todo', to: 'inprogress' } })
    expect(result.current.projectTasks.tasks.find((candidate) => candidate.id === task.id)?.status).toBe('inprogress')
    expect(result.current.allTasks.tasks.find((candidate) => candidate.id === task.id)?.status).toBe('inprogress')
  })

  it('rejects a missing transition id and a real transition whose source does not match the task', async () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.projectTasks.tasks.find((candidate) => candidate.status === 'todo')!
    let missing; let sourceMismatch

    await act(async () => {
      missing = await result.current.transitions.transitionTask({ projectId, taskId: task.id, transitionId: 'transition-to-any-status' })
      sourceMismatch = await result.current.transitions.transitionTask({ projectId, taskId: task.id, transitionId: 'transition-inprogress-review' })
    })

    expect(missing).toMatchObject({ ok: false, code: 'transition-not-found' })
    expect(sourceMismatch).toMatchObject({ ok: false, code: 'source-mismatch' })
    expect(result.current.projectTasks.tasks.find((candidate) => candidate.id === task.id)?.status).toBe('todo')
  })

  it('rejects a task from another project before resolving a transition', async () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const foreignTask = result.current.allTasks.tasks.find((task) => task.projectId !== projectId)!
    let execution

    await act(async () => {
      execution = await result.current.transitions.transitionTask({ projectId, taskId: foreignTask.id, transitionId: 'transition-todo-inprogress' })
    })

    expect(execution).toMatchObject({ ok: false, code: 'project-mismatch' })
  })

  it('ignores a draft-only transition and resolves it only after publication', async () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.projectTasks.tasks.find((candidate) => candidate.status === 'todo')!
    const active = result.current.catalog.getActiveWorkflow(projectId)!
    const publishedTransition = { id: 'transition-todo-done-published', from: 'todo', to: 'done' }

    const beforePublish = result.current.transitions.getTaskTransitions({ projectId, taskId: task.id })
    if (!beforePublish.ok) throw new Error('active transition resolution failed')
    expect(beforePublish.transitions.some((transition) => transition.id === publishedTransition.id)).toBe(false)
    await act(async () => {
      await result.current.catalog.publishWorkflow(active.workflowId, { statuses: active.statuses, transitions: [...active.transitions, publishedTransition] })
    })
    const afterPublish = result.current.transitions.getTaskTransitions({ projectId, taskId: task.id })
    if (!afterPublish.ok) throw new Error('published transition resolution failed')
    expect(afterPublish.transitions.some((transition) => transition.id === publishedTransition.id)).toBe(true)
  })

  it('requires an actual transition identity instead of accepting an arbitrary destination status', async () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.projectTasks.tasks.find((candidate) => candidate.status === 'todo')!
    let execution

    await act(async () => {
      execution = await result.current.transitions.transitionTask({ projectId, taskId: task.id, transitionId: 'done' })
    })

    expect(execution).toMatchObject({ ok: false, code: 'transition-not-found' })
    expect(result.current.projectTasks.tasks.find((candidate) => candidate.id === task.id)?.status).toBe('todo')
  })

  it('re-evaluates an assignee condition at commit time and leaves a denied task in its Board-derived status', async () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.projectTasks.tasks.find((candidate) => candidate.status === 'todo' && candidate.assignee !== 'm1')!
    const transition: WorkflowTransition = {
      id: 'assignee-guarded', from: 'todo', to: 'inprogress',
      conditions: { id: 'root', kind: 'group', operator: 'AND', children: [{ id: 'assignee', kind: 'rule', field: 'task.assignee', operator: 'equals', value: { source: 'CURRENT_USER_ID' } }] },
    }
    await act(async () => { await publishPolicyTransition(result.current, transition) })

    let execution
    await act(async () => { execution = await result.current.transitions.transitionTask({ projectId, taskId: task.id, transitionId: transition.id }) })

    expect(execution).toMatchObject({ ok: false, code: 'condition-failed', failedConditionRuleIds: ['assignee'] })
    expect(result.current.allTasks.tasks.find((candidate) => candidate.id === task.id)?.status).toBe('todo')
  })

  it('executes a matching-role transition through the central rule engine', async () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.projectTasks.tasks.find((candidate) => candidate.status === 'todo')!
    const transition: WorkflowTransition = {
      id: 'pm-role-guarded', from: 'todo', to: 'inprogress',
      conditions: { id: 'root', kind: 'group', operator: 'AND', children: [{ id: 'pm', kind: 'rule', field: 'actor.roleIds', operator: 'contains', value: { source: 'LITERAL', value: 'pm' } }] },
    }
    await act(async () => { await publishPolicyTransition(result.current, transition) })

    let execution
    await act(async () => { execution = await result.current.transitions.transitionTask({ projectId, taskId: task.id, transitionId: transition.id }) })

    expect(execution).toMatchObject({ ok: true, code: 'transitioned' })
    expect(result.current.allTasks.tasks.find((candidate) => candidate.id === task.id)?.status).toBe('inprogress')
  })

  it('runs the acceptance-criteria validator only at transition commit and preserves status when it fails', async () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.projectTasks.tasks.find((candidate) => candidate.status === 'todo')!
    const transition: WorkflowTransition = {
      id: 'criteria-guarded', from: 'todo', to: 'inprogress',
      validators: [{ id: 'criteria-complete', field: 'task.acceptanceCriteria', operator: 'equals', value: { source: 'LITERAL', value: true }, message: 'همهٔ معیارهای پذیرش باید تکمیل شوند.' }],
    }
    await act(async () => { await publishPolicyTransition(result.current, transition) })

    let denied
    await act(async () => { denied = await result.current.transitions.transitionTask({ projectId, taskId: task.id, transitionId: transition.id }) })
    expect(denied).toMatchObject({ ok: false, code: 'validation-failed', validationErrors: ['همهٔ معیارهای پذیرش باید تکمیل شوند.'] })
    expect(result.current.allTasks.tasks.find((candidate) => candidate.id === task.id)?.status).toBe('todo')

    await act(async () => { await result.current.allTasks.updateTask(task.id, { acceptanceCriteria: [{ id: 'ac-1', title: 'بازبینی', completed: true }] }) })
    let approved
    await act(async () => { approved = await result.current.transitions.transitionTask({ projectId, taskId: task.id, transitionId: transition.id }) })
    expect(approved).toMatchObject({ ok: true, code: 'transitioned' })
  })

  it('keeps an approval-required Board transition in place until its authoritative request is approved, then commits the exact transition id', async () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.projectTasks.tasks.find((candidate) => candidate.status === 'todo')!
    const approvers = [...new Set(result.current.allTasks.tasks.map((candidate) => candidate.assignee))]
      .filter((memberId) => memberId !== 'm1')
      .slice(0, 2)
    const transition: WorkflowTransition = {
      id: 'approval-guarded', from: 'todo', to: 'inprogress',
      approval: { mode: 'required', approverType: 'member', approverIds: approvers, minApprovals: 2, requesterCanApprove: false, rejectionRequiresReason: false },
    }
    await act(async () => { await publishPolicyTransition(result.current, transition) })

    let beforeApproval
    await act(async () => { beforeApproval = await result.current.transitions.transitionTask({ projectId, taskId: task.id, transitionId: transition.id }) })
    expect(beforeApproval).toMatchObject({ ok: false, code: 'approval-required', transition: { id: transition.id } })
    expect(result.current.allTasks.tasks.find((candidate) => candidate.id === task.id)?.status).toBe('todo')

    let created: ApprovalCreateMutationResult | undefined
    await act(async () => { created = await result.current.approval.createRequest({ projectId, task, transition, requesterId: 'm1' }) })
    expect(created).toMatchObject({ ok: true, reason: 'approval-request-created' })
    if (!created || created.reason !== 'approval-request-created') throw new Error('approval request creation failed')
    const createdRequest = created.request
    const published = result.current.catalog.getActiveWorkflow(projectId)!
    await act(async () => { expect(await result.current.approval.approveRequest(createdRequest.id, projectId, approvers[0]!, published.transitions)).toMatchObject({ ok: true, reason: 'pending-more-approvals' }) })
    let afterOneApproval
    await act(async () => { afterOneApproval = await result.current.transitions.transitionTask({ projectId, taskId: task.id, transitionId: transition.id }) })
    expect(afterOneApproval).toMatchObject({ ok: false, code: 'approval-required' })
    await act(async () => { expect(await result.current.approval.approveRequest(createdRequest.id, projectId, approvers[1]!, published.transitions)).toMatchObject({ ok: true, reason: 'approved' }) })
    expect(result.current.allTasks.tasks.find((candidate) => candidate.id === task.id)?.status).toBe('todo')

    let afterApproval
    await act(async () => { afterApproval = await result.current.transitions.transitionTask({ projectId, taskId: task.id, transitionId: transition.id }) })
    expect(afterApproval).toMatchObject({ ok: true, code: 'transitioned', transition: { id: transition.id } })
    expect(result.current.allTasks.tasks.find((candidate) => candidate.id === task.id)?.status).toBe('inprogress')
  })
})
