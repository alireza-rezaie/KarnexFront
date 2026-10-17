import type { ApprovalRequest } from '@/types/approvalRequest'
import type { Member } from '@/types/member'
import type { Role } from '@/types/role'

export type ApprovalActionState = {
  eligible: boolean
  requesterRestricted: boolean
  vote?: ApprovalRequest['votes'][number]
}

export function getApprovalActionState(
  request: ApprovalRequest,
  currentMember: Member | null | undefined,
  members: Member[],
  roles: Role[],
): ApprovalActionState {
  if (!currentMember) return { eligible: false, requesterRestricted: false }
  const vote = request.votes.find((item) => item.memberId === currentMember.id)
  const requesterRestricted = request.requesterId === currentMember.id && !request.policySnapshot.requesterCanApprove
  const validRoleIds = new Set(roles.map((role) => role.id))
  const memberStillExists = members.some((member) => member.id === currentMember.id)
  const eligibleByPolicy = request.policySnapshot.approverType === 'member'
    ? request.policySnapshot.approverIds.includes(currentMember.id)
    : Boolean(currentMember.roleId && validRoleIds.has(currentMember.roleId) && request.policySnapshot.approverIds.includes(currentMember.roleId))

  return {
    eligible: request.status === 'pending' && memberStillExists && eligibleByPolicy && !requesterRestricted && !vote,
    requesterRestricted,
    vote,
  }
}

export function approvalStatusLabel(status: ApprovalRequest['status']) {
  return {
    pending: 'در انتظار تأیید',
    approved: 'تأیید شده',
    rejected: 'رد شده',
    invalidated: 'منقضی / نامعتبر',
  }[status]
}
