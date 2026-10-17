import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { projects } from '@/test/fixtures/mockData'
import { ApprovalRequestsProvider, useApprovalRequests } from '@/contexts/ApprovalRequestsContext'
import { CurrentUserProvider, useCurrentUser } from '@/contexts/CurrentUserContext'
import { MembersProvider, useMembers } from '@/contexts/MembersContext'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { ProjectStatusProvider } from '@/contexts/ProjectStatusContext'
import { ProjectTaskProvider, useProjectTasks } from '@/contexts/ProjectTaskContext'
import { ProjectWorkflowProvider, useProjectWorkflow } from '@/contexts/ProjectWorkflowContext'
import { ProjectsProvider } from '@/contexts/ProjectsContext'
import { RolesProvider } from '@/contexts/RolesContext'
import { TasksProvider, useTasks } from '@/contexts/TasksContext'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import type { WorkflowTransition } from '@/types/workflow'
import { createWorkflowDraft } from '@/utils/workflowEditor'
import { evaluateTaskTransitionAttempt } from '@/utils/taskTransitionPolicy'

const projectId = projects[0]!.id
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthenticatedTestProvider userId="m1"><MembersProvider>
      <RolesProvider>
        <ProjectsProvider>
          <TasksProvider>
            <ApprovalRequestsProvider>
              <MemoryRouter initialEntries={[`/projects/${projectId}/workflow`]}>
                <Routes>
                  <Route path="/projects/:projectId/*" element={<CurrentUserProvider><ProjectProvider><ProjectTaskProvider><ProjectWorkflowProvider><ProjectStatusProvider>{children}</ProjectStatusProvider></ProjectWorkflowProvider></ProjectTaskProvider></ProjectProvider></CurrentUserProvider>} />
                </Routes>
              </MemoryRouter>
            </ApprovalRequestsProvider>
          </TasksProvider>
        </ProjectsProvider>
      </RolesProvider>
    </MembersProvider></AuthenticatedTestProvider>
  )
}
function useRuntime() {
  return { approval: useApprovalRequests(), workflow: useProjectWorkflow(), tasks: useProjectTasks(), allTasks: useTasks(), current: useCurrentUser(), members: useMembers() }
}
function policyTransition(taskStatus: string, policy: WorkflowTransition['approval'], conditions?: WorkflowTransition['conditions'], validators?: WorkflowTransition['validators']): WorkflowTransition {
  return { id: 'e2e-transition', from: taskStatus, to: 'inprogress', approval: policy, conditions, validators }
}

describe('workflow and approval end-to-end boundary', () => {
  it('keeps a draft-only rule out of runtime until the workflow context is published', () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.tasks.tasks.find((item) => item.status === 'todo')!
    const draftTransition = policyTransition(task.status, { mode: 'required', approverType: 'member', approverIds: ['m2'], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: false })
    const draft = createWorkflowDraft([], [draftTransition], {})

    expect(draft.transitions[0]?.approval?.mode).toBe('required')
    expect(evaluateTaskTransitionAttempt({ task, targetStatusId: 'inprogress', transitions: result.current.workflow.transitions, currentMember: result.current.current.currentMember, actorRoleIds: [] }).reason).toBe('allowed')
    act(() => expect(result.current.workflow.replaceTransitions([draftTransition])).toBe(true))
    expect(evaluateTaskTransitionAttempt({ task, targetStatusId: 'inprogress', transitions: result.current.workflow.transitions, currentMember: result.current.current.currentMember, actorRoleIds: [] }).reason).toBe('approval-required')
  })

  it('stops before approval-request creation when conditions or validators fail', () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.tasks.tasks.find((item) => item.status === 'todo')!
    const required = { mode: 'required' as const, approverType: 'member' as const, approverIds: ['m2'], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: false }
    const conditionFail = policyTransition(task.status, required, { id: 'root', kind: 'group', operator: 'AND', children: [{ id: 'fail', kind: 'rule', field: 'task.type', operator: 'equals', value: { source: 'LITERAL', value: 'not-a-real-type' } }] })
    const validatorFail = policyTransition(task.status, required, undefined, [{ id: 'fail', field: 'task.assignee', operator: 'isEmpty', message: 'مسئول باید خالی باشد.' }])

    expect(evaluateTaskTransitionAttempt({ task, targetStatusId: 'inprogress', transitions: [conditionFail], currentMember: result.current.current.currentMember, actorRoleIds: [] }).reason).toBe('condition-failed')
    expect(evaluateTaskTransitionAttempt({ task, targetStatusId: 'inprogress', transitions: [validatorFail], currentMember: result.current.current.currentMember, actorRoleIds: [] })).toMatchObject({ reason: 'validation-failed', validationErrors: ['مسئول باید خالی باشد.'] })
    expect(result.current.approval.requests).toEqual([])
    expect(result.current.allTasks.tasks.find((item) => item.id === task.id)?.status).toBe(task.status)
  })

  it('uses the approval policy snapshot after a later workflow publish and updates status once', () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.tasks.tasks.find((item) => item.status === 'todo')!
    const requester = result.current.current.currentMember!
    const approver = result.current.members.members.find((member) => member.id !== requester.id)!
    const initial = policyTransition(task.status, { mode: 'required', approverType: 'member', approverIds: [approver.id], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: false })
    let requestId = ''
    act(() => {
      const created = result.current.approval.createRequest({ projectId, task, transition: initial, requesterId: requester.id })
      expect(created.reason).toBe('approval-request-created')
      if (created.reason === 'approval-request-created') requestId = created.request.id
      expect(result.current.workflow.replaceTransitions([{ ...initial, approval: { mode: 'required', approverType: 'member', approverIds: [requester.id], minApprovals: 1, requesterCanApprove: true, rejectionRequiresReason: false } }])).toBe(true)
    })
    act(() => expect(result.current.approval.approveRequest(requestId, projectId, approver.id, result.current.workflow.transitions)).toMatchObject({ ok: true, reason: 'approved' }))
    expect(result.current.approval.requests.find((request) => request.id === requestId)?.policySnapshot.approverIds).toEqual([approver.id])
    expect(result.current.allTasks.tasks.find((item) => item.id === task.id)?.status).toBe(task.status)
  })

  it('keeps requests isolated from votes attempted through another project id', () => {
    const { result } = renderHook(useRuntime, { wrapper: Wrapper })
    const task = result.current.tasks.tasks.find((item) => item.status === 'todo')!
    const requester = result.current.current.currentMember!
    const approver = result.current.members.members.find((member) => member.id !== requester.id)!
    const transition = policyTransition(task.status, { mode: 'required', approverType: 'member', approverIds: [approver.id], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: false })
    let requestId = ''
    act(() => {
      const created = result.current.approval.createRequest({ projectId, task, transition, requesterId: requester.id })
      if (created.reason === 'approval-request-created') requestId = created.request.id
    })
    act(() => expect(result.current.approval.approveRequest(requestId, 'other-project', approver.id, [transition])).toMatchObject({ ok: false, reason: 'project-mismatch' }))
    expect(result.current.approval.requests.find((request) => request.id === requestId)?.status).toBe('pending')
  })
})
