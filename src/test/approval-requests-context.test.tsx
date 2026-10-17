import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ApprovalRequestsProvider, useApprovalRequests } from '@/contexts/ApprovalRequestsContext'
import { MembersProvider, useMembers } from '@/contexts/MembersContext'
import { RolesProvider, useRoles } from '@/contexts/RolesContext'
import { TasksProvider, useTasks } from '@/contexts/TasksContext'
import type { WorkflowTransition } from '@/types/workflow'

function Wrapper({ children }: { children: ReactNode }) {
  return <MembersProvider><RolesProvider><TasksProvider><ApprovalRequestsProvider>{children}</ApprovalRequestsProvider></TasksProvider></RolesProvider></MembersProvider>
}
function useRuntime() {
  return { approval: useApprovalRequests(), members: useMembers(), roles: useRoles(), tasks: useTasks() }
}
function setup() {
  const hook = renderHook(useRuntime, { wrapper: Wrapper })
  const task = hook.result.current.tasks.tasks[0]!
  const requester = hook.result.current.members.members[0]!
  const approver = hook.result.current.members.members.find((member) => member.id !== requester.id)!
  const transition = (policy: WorkflowTransition['approval']): WorkflowTransition => ({ id: 'transition-approval', from: task.status, to: 'approval-target', approval: policy })
  return { hook, task, requester, approver, transition }
}

describe('ApprovalRequestsContext runtime engine', () => {
  it('does not create a request for approval none because the caller has no required policy', () => {
    const { hook, task, requester, transition } = setup()
    let result: ReturnType<typeof hook.result.current.approval.createRequest>
    act(() => { result = hook.result.current.approval.createRequest({ projectId: task.projectId, task, transition: transition({ mode: 'none' }), requesterId: requester.id }) })
    expect(result!.reason).toBe('approval-policy-missing')
    expect(hook.result.current.approval.requests).toEqual([])
  })
  it('creates a project-scoped request with a policy snapshot without changing task status', () => {
    const { hook, task, requester, approver, transition } = setup()
    const policy = { mode: 'required' as const, approverType: 'member' as const, approverIds: [approver.id], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: true }
    let result: ReturnType<typeof hook.result.current.approval.createRequest>
    act(() => { result = hook.result.current.approval.createRequest({ projectId: task.projectId, task, transition: transition(policy), requesterId: requester.id }) })
    expect(result!).toMatchObject({ reason: 'approval-request-created', request: { projectId: task.projectId, taskId: task.id, sourceStatusId: task.status, status: 'pending', policySnapshot: policy } })
    expect(hook.result.current.tasks.tasks.find((item) => item.id === task.id)?.status).toBe(task.status)
  })
  it('prevents duplicate pending requests for one task', () => {
    const { hook, task, requester, approver, transition } = setup()
    const input = { projectId: task.projectId, task, transition: transition({ mode: 'required', approverType: 'member' as const, approverIds: [approver.id], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: false }), requesterId: requester.id }
    let first: ReturnType<typeof hook.result.current.approval.createRequest> | undefined; let second: ReturnType<typeof hook.result.current.approval.createRequest> | undefined
    act(() => { first = hook.result.current.approval.createRequest(input); second = hook.result.current.approval.createRequest(input) })
    expect(first!.reason).toBe('approval-request-created')
    expect(second!).toMatchObject({ reason: 'approval-already-pending' })
  })
  it('rejects request creation when eligible approvers cannot satisfy the minimum', () => {
    const { hook, task, requester, approver, transition } = setup()
    let result: ReturnType<typeof hook.result.current.approval.createRequest>
    act(() => { result = hook.result.current.approval.createRequest({ projectId: task.projectId, task, transition: transition({ mode: 'required', approverType: 'member', approverIds: [approver.id], minApprovals: 2, requesterCanApprove: false, rejectionRequiresReason: false }), requesterId: requester.id }) })
    expect(result!.reason).toBe('insufficient-eligible-approvers')
  })
  it('enforces member eligibility and requester restriction', () => {
    const { hook, task, requester, approver, transition } = setup()
    let created: Extract<ReturnType<typeof hook.result.current.approval.createRequest>, { reason: 'approval-request-created' }>
    act(() => { created = hook.result.current.approval.createRequest({ projectId: task.projectId, task, transition: transition({ mode: 'required', approverType: 'member', approverIds: [requester.id, approver.id], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: false }), requesterId: requester.id }) as typeof created })
    act(() => expect(hook.result.current.approval.approveRequest(created!.request.id, task.projectId, requester.id, [transition(created!.request.policySnapshot)])).toMatchObject({ ok: false, reason: 'requester-cannot-approve' }))
    act(() => expect(hook.result.current.approval.approveRequest(created!.request.id, task.projectId, approver.id, [transition(created!.request.policySnapshot)])).toMatchObject({ ok: true, reason: 'approved' }))
  })
  it('allows a real role approver', async () => {
    const { hook, task, requester, transition } = setup()
    const roleApprover = hook.result.current.members.members.find((member) => member.id !== requester.id)!
    const roleId = hook.result.current.roles.roles[0]!.id
    await act(async () => { expect((await hook.result.current.members.updateMember?.(roleApprover.id, { roleId }))?.ok).toBe(true) })
    let created: Extract<ReturnType<typeof hook.result.current.approval.createRequest>, { reason: 'approval-request-created' }> | undefined
    const policy = { mode: 'required' as const, approverType: 'role' as const, approverIds: [roleId], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: false }
    act(() => { created = hook.result.current.approval.createRequest({ projectId: task.projectId, task, transition: transition(policy), requesterId: requester.id }) as typeof created })
    act(() => expect(hook.result.current.approval.approveRequest(created!.request.id, task.projectId, roleApprover.id, [transition(policy)])).toMatchObject({ ok: true, reason: 'approved' }))
  })
  it('keeps pending after first approval when two distinct approvals are required, then resolves once', () => {
    const { hook, task, requester, transition } = setup()
    const approvers = hook.result.current.members.members.filter((member) => member.id !== requester.id).slice(0, 2)
    const policy = { mode: 'required' as const, approverType: 'member' as const, approverIds: approvers.map((member) => member.id), minApprovals: 2, requesterCanApprove: false, rejectionRequiresReason: false }
    let created: Extract<ReturnType<typeof hook.result.current.approval.createRequest>, { reason: 'approval-request-created' }> | undefined
    act(() => { created = hook.result.current.approval.createRequest({ projectId: task.projectId, task, transition: transition(policy), requesterId: requester.id }) as typeof created })
    act(() => expect(hook.result.current.approval.approveRequest(created!.request.id, task.projectId, approvers[0]!.id, [transition(policy)])).toMatchObject({ ok: true, reason: 'pending-more-approvals' }))
    expect(hook.result.current.approval.requests[0]?.status).toBe('pending')
    act(() => expect(hook.result.current.approval.approveRequest(created!.request.id, task.projectId, approvers[1]!.id, [transition(policy)])).toMatchObject({ ok: true, reason: 'approved' }))
    expect(hook.result.current.tasks.tasks.find((item) => item.id === task.id)?.status).toBe(task.status)
    expect(hook.result.current.approval.isTransitionApproved({ projectId: task.projectId, taskId: task.id, currentStatusId: task.status, transition: transition(policy) })).toBe(true)
    expect(hook.result.current.approval.isTransitionApproved({ projectId: 'other-project', taskId: task.id, currentStatusId: task.status, transition: transition(policy) })).toBe(false)
    expect(hook.result.current.approval.isTransitionApproved({ projectId: task.projectId, taskId: 'other-task', currentStatusId: task.status, transition: transition(policy) })).toBe(false)
  })
  it('blocks duplicate votes and project-crossing votes', () => {
    const { hook, task, requester, approver, transition } = setup()
    const secondApprover = hook.result.current.members.members.find((member) => member.id !== requester.id && member.id !== approver.id)!
    const policy = { mode: 'required' as const, approverType: 'member' as const, approverIds: [approver.id, secondApprover.id], minApprovals: 2, requesterCanApprove: false, rejectionRequiresReason: false }
    let created: Extract<ReturnType<typeof hook.result.current.approval.createRequest>, { reason: 'approval-request-created' }> | undefined
    act(() => { created = hook.result.current.approval.createRequest({ projectId: task.projectId, task, transition: transition(policy), requesterId: requester.id }) as typeof created })
    act(() => expect(hook.result.current.approval.approveRequest(created!.request.id, 'other-project', approver.id, [transition(policy)])).toMatchObject({ ok: false, reason: 'project-mismatch' }))
    act(() => expect(hook.result.current.approval.approveRequest(created!.request.id, task.projectId, approver.id, [transition(policy)])).toMatchObject({ ok: true, reason: 'pending-more-approvals' }))
    act(() => expect(hook.result.current.approval.approveRequest(created!.request.id, task.projectId, approver.id, [transition(policy)])).toMatchObject({ ok: false, reason: 'already-voted' }))
  })
  it('keeps approval requests valid when a generic task edit does not alter status', () => {
    const { hook, task, requester, approver, transition } = setup()
    const policy = { mode: 'required' as const, approverType: 'member' as const, approverIds: [approver.id], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: false }
    let created: Extract<ReturnType<typeof hook.result.current.approval.createRequest>, { reason: 'approval-request-created' }> | undefined
    act(() => { created = hook.result.current.approval.createRequest({ projectId: task.projectId, task, transition: transition(policy), requesterId: requester.id }) as typeof created; hook.result.current.tasks.updateTask(task.id, { title: 'ویرایش بی‌وضعیت' }) })
    act(() => expect(hook.result.current.approval.approveRequest(created!.request.id, task.projectId, approver.id, [transition(policy)])).toMatchObject({ ok: true, reason: 'approved' }))
    expect(hook.result.current.tasks.tasks.find((item) => item.id === task.id)?.status).toBe(task.status)
    expect(hook.result.current.approval.isTransitionApproved({ projectId: task.projectId, taskId: task.id, currentStatusId: task.status, transition: transition(policy) })).toBe(true)
  })
  it('rejects with required and optional reasons without changing task status', () => {
    const { hook, task, requester, approver, transition } = setup()
    const required = { mode: 'required' as const, approverType: 'member' as const, approverIds: [approver.id], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: true }
    let created: Extract<ReturnType<typeof hook.result.current.approval.createRequest>, { reason: 'approval-request-created' }>
    act(() => { created = hook.result.current.approval.createRequest({ projectId: task.projectId, task, transition: transition(required), requesterId: requester.id }) as typeof created })
    act(() => expect(hook.result.current.approval.rejectRequest(created!.request.id, task.projectId, approver.id)).toMatchObject({ ok: false, reason: 'reason-required' }))
    act(() => expect(hook.result.current.approval.rejectRequest(created!.request.id, task.projectId, approver.id, 'نیاز به بررسی بیشتر')).toMatchObject({ ok: true, reason: 'rejected' }))
    expect(hook.result.current.tasks.tasks.find((item) => item.id === task.id)?.status).toBe(task.status)
    expect(hook.result.current.approval.isTransitionApproved({ projectId: task.projectId, taskId: task.id, currentStatusId: task.status, transition: transition(required) })).toBe(false)
  })
})
