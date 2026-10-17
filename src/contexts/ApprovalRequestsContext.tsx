import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMembers } from '@/contexts/MembersContext'
import { useRoles } from '@/contexts/RolesContext'
import { useTasks } from '@/contexts/TasksContext'
import type { Task } from '@/types/task'
import type { WorkflowTransition } from '@/types/workflow'
import type { ApprovalCapabilities, ApprovalCreateMutationResult, ApprovalDisplayCopy, ApprovalRequest, ApprovalVote, ApprovalVoteMutationResult } from '@/types/approvalRequest'

type CreateApprovalRequestInput = { projectId: string; task: Task; transition: WorkflowTransition; requesterId?: string }
type ApprovalTransitionScope = { projectId: string; taskId: string; currentStatusId: string; transition: WorkflowTransition }
type ApprovalRequestsContextValue = {
  requests: ApprovalRequest[]
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  capabilities: ApprovalCapabilities
  displayCopy: ApprovalDisplayCopy
  createRequest: (input: CreateApprovalRequestInput) => Promise<ApprovalCreateMutationResult> & ApprovalCreateMutationResult
  approveRequest: (requestId: string, projectId: string, memberId: string, transitions: WorkflowTransition[]) => Promise<ApprovalVoteMutationResult> & ApprovalVoteMutationResult
  rejectRequest: (requestId: string, projectId: string, memberId: string, reason?: string) => Promise<ApprovalVoteMutationResult> & ApprovalVoteMutationResult
  /** Read-only authorization lookup. It never moves a Task or counts votes outside the request authority. */
  isTransitionApproved: (scope: ApprovalTransitionScope) => boolean
}

const ApprovalRequestsContext = createContext<ApprovalRequestsContextValue | undefined>(undefined)
const now = () => new Date().toISOString()

export function ApprovalRequestsProvider({ children }: { children: ReactNode }) {
  const { tasks } = useTasks()
  const { members } = useMembers()
  const { roles } = useRoles()
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const requestsRef = useRef(requests)
  const tasksRef = useRef(tasks)
  useEffect(() => { tasksRef.current = tasks }, [tasks])
  const setRuntimeRequests = useCallback((next: ApprovalRequest[]) => { requestsRef.current = next; setRequests(next) }, [])
  const eligibleMembers = useCallback((request: Pick<ApprovalRequest, 'policySnapshot' | 'requesterId'>) => {
    const policy = request.policySnapshot
    const validRoleIds = new Set(roles.map((role) => role.id))
    return members.filter((member) => {
      const matches = policy.approverType === 'member'
        ? policy.approverIds.includes(member.id)
        : Boolean(member.roleId && validRoleIds.has(member.roleId) && policy.approverIds.includes(member.roleId))
      return matches && (policy.requesterCanApprove || member.id !== request.requesterId)
    })
  }, [members, roles])

  const createRequest = useCallback((input: CreateApprovalRequestInput): ApprovalCreateMutationResult => {
    const policy = input.transition.approval
    if (input.task.projectId !== input.projectId) return { ok: false, reason: 'project-mismatch' }
    if (!input.requesterId) return { ok: false, reason: 'missing-requester' }
    if (!policy || policy.mode !== 'required') return { ok: false, reason: 'approval-policy-missing' }
    const existing = requestsRef.current.find((request) => request.projectId === input.projectId && request.taskId === input.task.id && request.status === 'pending')
    if (existing) return { ok: false, reason: 'approval-already-pending', requestId: existing.id }
    const candidate: Omit<ApprovalRequest, 'id' | 'createdAt'> = {
      projectId: input.projectId, taskId: input.task.id, transitionId: input.transition.id,
      sourceStatusId: input.task.status, targetStatusId: input.transition.to, requesterId: input.requesterId,
      policySnapshot: { ...policy, approverIds: [...policy.approverIds] }, status: 'pending', votes: [],
    }
    if (eligibleMembers(candidate).length < policy.minApprovals) return { ok: false, reason: 'insufficient-eligible-approvers' }
    const request: ApprovalRequest = { ...candidate, id: `approval-${crypto.randomUUID()}`, createdAt: now() }
    setRuntimeRequests([...requestsRef.current, request])
    return { ok: true, reason: 'approval-request-created', request }
  }, [eligibleMembers, setRuntimeRequests])

  const approveRequest = useCallback((requestId: string, projectId: string, memberId: string, transitions: WorkflowTransition[]): ApprovalVoteMutationResult => {
    const request = requestsRef.current.find((item) => item.id === requestId)
    if (!request) return { ok: false, reason: 'request-not-found' }
    if (request.projectId !== projectId) return { ok: false, reason: 'project-mismatch' }
    if (request.status !== 'pending') return { ok: false, reason: 'request-not-pending' }
    if (request.votes.some((vote) => vote.memberId === memberId)) return { ok: false, reason: 'already-voted' }
    const approver = eligibleMembers(request).find((member) => member.id === memberId)
    if (!approver) {
      const requester = request.requesterId === memberId && !request.policySnapshot.requesterCanApprove
      return { ok: false, reason: requester ? 'requester-cannot-approve' : 'unauthorized' }
    }
    const vote: ApprovalVote = { memberId, action: 'approve', createdAt: now() }
    const votes = [...request.votes, vote]
    if (votes.filter((item) => item.action === 'approve').length < request.policySnapshot.minApprovals) {
      setRuntimeRequests(requestsRef.current.map((item) => item.id === request.id ? { ...item, votes } : item))
      return { ok: true, reason: 'pending-more-approvals' }
    }
    const task = tasksRef.current.find((item) => item.id === request.taskId)
    const transitionStillValid = transitions.some((transition) => transition.id === request.transitionId && transition.from === request.sourceStatusId && transition.to === request.targetStatusId)
    if (!task || task.projectId !== request.projectId || task.status !== request.sourceStatusId || !transitionStillValid) {
      setRuntimeRequests(requestsRef.current.map((item) => item.id === request.id ? { ...item, votes, status: 'invalidated', resolvedAt: now() } : item))
      return { ok: false, reason: 'request-invalidated' }
    }
    // Approval grants authorization only. The protected workflow transition is
    // committed later by TaskTransitionContext with its exact transition id.
    setRuntimeRequests(requestsRef.current.map((item) => item.id === request.id ? { ...item, votes, status: 'approved', resolvedAt: now() } : item))
    return { ok: true, reason: 'approved' }
  }, [eligibleMembers, setRuntimeRequests])

  const rejectRequest = useCallback((requestId: string, projectId: string, memberId: string, reason?: string): ApprovalVoteMutationResult => {
    const request = requestsRef.current.find((item) => item.id === requestId)
    if (!request) return { ok: false, reason: 'request-not-found' }
    if (request.projectId !== projectId) return { ok: false, reason: 'project-mismatch' }
    if (request.status !== 'pending') return { ok: false, reason: 'request-not-pending' }
    if (request.votes.some((vote) => vote.memberId === memberId)) return { ok: false, reason: 'already-voted' }
    const approver = eligibleMembers(request).find((member) => member.id === memberId)
    if (!approver) return { ok: false, reason: request.requesterId === memberId && !request.policySnapshot.requesterCanApprove ? 'requester-cannot-approve' : 'unauthorized' }
    if (request.policySnapshot.rejectionRequiresReason && !reason?.trim()) return { ok: false, reason: 'reason-required' }
    const vote: ApprovalVote = { memberId, action: 'reject', ...(reason?.trim() ? { reason: reason.trim() } : {}), createdAt: now() }
    setRuntimeRequests(requestsRef.current.map((item) => item.id === request.id ? { ...item, votes: [...item.votes, vote], status: 'rejected', resolvedAt: now() } : item))
    return { ok: true, reason: 'rejected' }
  }, [eligibleMembers, setRuntimeRequests])

  const isTransitionApproved = useCallback(({ projectId, taskId, currentStatusId, transition }: ApprovalTransitionScope) => {
    const policy = transition.approval
    if (!policy || policy.mode !== 'required') return false
    return requestsRef.current.some((request) => (
      request.status === 'approved'
      && request.projectId === projectId
      && request.taskId === taskId
      && request.transitionId === transition.id
      && request.sourceStatusId === currentStatusId
      && request.targetStatusId === transition.to
      && JSON.stringify(request.policySnapshot) === JSON.stringify(policy)
    ))
  }, [])

  const value = useMemo<ApprovalRequestsContextValue>(() => {
    const displayCopy: ApprovalDisplayCopy = {
      serviceUnavailable: 'درخواست‌های تأیید پس از اتصال سرویس پروژه قابل مدیریت هستند.',
      requestsUnavailable: 'درخواست‌های تأیید پس از اتصال سرویس پروژه نمایش داده می‌شوند.',
      actionUnavailable: 'این عملیات پس از اتصال سرویس پروژه در دسترس خواهد بود.',
      loading: 'در حال دریافت درخواست‌های تأیید…',
    }
    return {
      // This is the frontend runtime adapter for the current session. Keeping it
      // active outside tests is required for an approved transition to complete
      // through TaskTransitionContext; a future API adapter can replace these
      // operations without changing Board or workflow business logic.
      requests,
      serviceAvailable: true,
      loading: false,
      error: null,
      capabilities: { canCreateRequest: true, canApproveRequest: true, canRejectRequest: true },
      displayCopy,
      createRequest: createRequest as unknown as ApprovalRequestsContextValue['createRequest'],
      approveRequest: approveRequest as unknown as ApprovalRequestsContextValue['approveRequest'],
      rejectRequest: rejectRequest as unknown as ApprovalRequestsContextValue['rejectRequest'],
      isTransitionApproved,
    }
  }, [requests, createRequest, approveRequest, rejectRequest, isTransitionApproved])
  return <ApprovalRequestsContext.Provider value={value}>{children}</ApprovalRequestsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApprovalRequests() {
  const context = useContext(ApprovalRequestsContext)
  if (!context) throw new Error('useApprovalRequests must be used within an ApprovalRequestsProvider.')
  return context
}
