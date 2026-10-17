import type { ApprovalPolicy } from '@/types/workflowPolicy'

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'invalidated'
export type ApprovalVote = {
  memberId: string
  action: 'approve' | 'reject'
  reason?: string
  createdAt: string
}
export type ApprovalPolicySnapshot = Extract<ApprovalPolicy, { mode: 'required' }>
export type ApprovalRequest = {
  id: string
  projectId: string
  taskId: string
  transitionId: string
  sourceStatusId: string
  targetStatusId: string
  requesterId: string
  policySnapshot: ApprovalPolicySnapshot
  status: ApprovalRequestStatus
  votes: ApprovalVote[]
  createdAt: string
  resolvedAt?: string
}

export type ApprovalCapabilities = {
  canCreateRequest: boolean
  canApproveRequest: boolean
  canRejectRequest: boolean
}

export type ApprovalDisplayCopy = {
  serviceUnavailable: string
  requestsUnavailable: string
  actionUnavailable: string
  loading: string
}

export type ApprovalCreateReason =
  | 'approval-request-created'
  | 'approval-already-pending'
  | 'insufficient-eligible-approvers'
  | 'approval-policy-missing'
  | 'project-mismatch'
  | 'missing-requester'
  | 'service-unavailable'

export type ApprovalVoteReason =
  | 'approved'
  | 'pending-more-approvals'
  | 'rejected'
  | 'unauthorized'
  | 'requester-cannot-approve'
  | 'already-voted'
  | 'request-not-pending'
  | 'request-not-found'
  | 'request-invalidated'
  | 'reason-required'
  | 'project-mismatch'
  | 'service-unavailable'

export type ApprovalCreateMutationResult =
  | { ok: true; reason: 'approval-request-created'; request: ApprovalRequest }
  | { ok: false; reason: Exclude<ApprovalCreateReason, 'approval-request-created'>; requestId?: string; message?: string }

export type ApprovalVoteMutationResult =
  | { ok: true; reason: Extract<ApprovalVoteReason, 'approved' | 'pending-more-approvals' | 'rejected'> }
  | { ok: false; reason: Exclude<ApprovalVoteReason, 'approved' | 'pending-more-approvals' | 'rejected'>; message?: string }
