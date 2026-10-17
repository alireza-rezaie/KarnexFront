import { describe, expect, it } from 'vitest'
import type {
  RemoveTeamMemberRequest,
  SetTeamLeadRequest,
  TeamApiFailure,
} from '@/types/teamApi'

describe('team API contract', () => {
  it('makes lead removal explicit and version-ready', () => {
    const removal: RemoveTeamMemberRequest = {
      teamId: 'team-a',
      expectedVersion: 'team-version-2',
      memberId: 'member-lead',
      nextLeadId: 'member-b',
    }

    expect(removal.nextLeadId).toBe('member-b')
  })

  it('represents the current explicit no-lead state', () => {
    const lead: SetTeamLeadRequest = {
      teamId: 'team-a',
      expectedVersion: 'team-version-2',
      leadId: null,
    }

    expect(lead.leadId).toBeNull()
  })

  it('uses typed failures for membership and lead integrity', () => {
    const duplicate: TeamApiFailure = { ok: false, code: 'duplicate_membership' }
    const invalidLead: TeamApiFailure = { ok: false, code: 'invalid_lead' }

    expect([duplicate.code, invalidLead.code]).toEqual(['duplicate_membership', 'invalid_lead'])
  })
})
