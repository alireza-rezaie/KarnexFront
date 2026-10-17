import type { Member } from '@/types/member'

export interface Team {
  id: string
  name: string
  description?: string
  leadId?: Member['id']
  memberIds: Member['id'][]
  activity: string
  tone: string
}

export type CreateTeamInput = Pick<Team, 'name'> & Partial<Pick<Team, 'description' | 'leadId' | 'memberIds'>>
export type UpdateTeamInput = Partial<Pick<Team, 'name' | 'description' | 'leadId' | 'memberIds'>>

export type TeamMutationResult =
  | { ok: true; team?: Team }
  | { ok: false; message?: string }

export interface TeamCapabilities {
  canCreateTeam: boolean
  canUpdateTeam: boolean
  canAddTeamMember: boolean
  canRemoveTeamMember: boolean
  canSetTeamLead: boolean
}

export interface TeamDisplayCopy {
  serviceUnavailable: string
  actionUnavailable: string
  loading: string
}
