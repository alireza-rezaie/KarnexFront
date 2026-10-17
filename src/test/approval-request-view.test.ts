import { describe, expect, it } from 'vitest'
import type { ApprovalRequest } from '@/types/approvalRequest'
import type { Member } from '@/types/member'
import type { Role } from '@/types/role'
import { approvalStatusLabel, getApprovalActionState } from '@/utils/approvalRequestView'

const members: Member[] = [
  { id: 'm1', name: 'امیر', email: 'amir@example.test', jobTitle: '', avatar: '', status: 'online', projects: ['p1'], lastActivity: '' },
  { id: 'm2', name: 'سارا', email: 'sara@example.test', jobTitle: '', avatar: '', status: 'offline', projects: ['p1'], lastActivity: '' },
]
const roles: Role[] = [{ id: 'r1', name: 'مدیر', description: '' }]
const request = (overrides: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  id: 'request-1', projectId: 'p1', taskId: 't1', transitionId: 'tr1', sourceStatusId: 'todo', targetStatusId: 'review', requesterId: 'm2',
  policySnapshot: { mode: 'required', approverType: 'member', approverIds: ['m1'], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: true },
  status: 'pending', votes: [], createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
})

describe('approval request view derivation', () => {
  it('maps every runtime status to a Persian label', () => {
    expect(approvalStatusLabel('pending')).toBe('در انتظار تأیید')
    expect(approvalStatusLabel('approved')).toBe('تأیید شده')
    expect(approvalStatusLabel('rejected')).toBe('رد شده')
    expect(approvalStatusLabel('invalidated')).toBe('منقضی / نامعتبر')
  })
  it('shows actions only to an eligible pending member approver', () => {
    expect(getApprovalActionState(request(), members[0], members, roles)).toMatchObject({ eligible: true, requesterRestricted: false })
    expect(getApprovalActionState(request(), members[1], members, roles).eligible).toBe(false)
  })
  it('honors a real role relation for role-based approval', () => {
    const roleMember = { ...members[0], roleId: 'r1' }
    const roleRequest = request({ policySnapshot: { mode: 'required', approverType: 'role', approverIds: ['r1'], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: false } })
    expect(getApprovalActionState(roleRequest, roleMember, [roleMember, members[1]], roles).eligible).toBe(true)
    expect(getApprovalActionState(roleRequest, { ...roleMember, roleId: 'missing' }, [roleMember, members[1]], roles).eligible).toBe(false)
  })
  it('hides actions after a vote or terminal status', () => {
    expect(getApprovalActionState(request({ votes: [{ memberId: 'm1', action: 'approve', createdAt: '' }] }), members[0], members, roles)).toMatchObject({ eligible: false, vote: { action: 'approve' } })
    expect(getApprovalActionState(request({ status: 'invalidated' }), members[0], members, roles).eligible).toBe(false)
  })
  it('reflects requester restriction without relying on UI alone', () => {
    const selfRequest = request({ requesterId: 'm1' })
    expect(getApprovalActionState(selfRequest, members[0], members, roles)).toMatchObject({ eligible: false, requesterRestricted: true })
  })
})
