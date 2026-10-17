import type { CreateTeamInput, Team, UpdateTeamInput } from '@/types/team'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, ApiVersionMismatch, IdempotentCommand } from '@/types/api'

/** Canonical transport failures for team management operations. */
export type TeamApiErrorCode = ApiErrorCode<
  | 'duplicate_membership'
  | 'invalid_member'
  | 'invalid_lead'
>

export type TeamApiFailure = ApiFailure<TeamApiErrorCode, {
  currentVersion?: string
}>

export type TeamApiSuccess<T> = ApiSuccess<T>
export type TeamApiResult<T> = ApiResult<T, TeamApiErrorCode, { currentVersion?: string }>
export type TeamMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentTeamVersion'>
  | ApiFailure<Exclude<TeamApiErrorCode, 'version_mismatch'>>

export type AuthoritativeTeam = Team & {
  version: string
}

export type TeamVersionPrecondition = {
  teamId: string
  expectedVersion: string
}

export type ListTeamsQuery = {
  memberId?: string
  leadId?: string
  cursor?: string
  limit?: number
}

export type ListTeamsResponse = TeamApiResult<{
  teams: AuthoritativeTeam[]
  nextCursor?: string
}>

export type GetTeamResponse = TeamApiResult<{
  team: AuthoritativeTeam
}>

export type CreateTeamRequest = IdempotentCommand & {
  input: CreateTeamInput
}

export type CreateTeamResponse = TeamApiResult<{
  team: AuthoritativeTeam
}>

export type UpdateTeamRequest = TeamVersionPrecondition & {
  changes: UpdateTeamInput
}

export type UpdateTeamResponse = TeamMutationResponse<{
  team: AuthoritativeTeam
}>

export type DeleteTeamRequest = TeamVersionPrecondition
export type DeleteTeamResponse = TeamMutationResponse<{ teamId: string }>

export type AddTeamMemberRequest = TeamVersionPrecondition & {
  memberId: string
}

export type RemoveTeamMemberRequest = TeamVersionPrecondition & {
  memberId: string
  /** Required when removing a lead: another member ID, or null for the current supported no-lead state. */
  nextLeadId?: string | null
}

export type SetTeamLeadRequest = TeamVersionPrecondition & {
  /** Null explicitly selects the existing supported no-lead state. A non-null lead must already be a member. */
  leadId: string | null
}

export type TeamMembershipMutationResponse = TeamMutationResponse<{
  team: AuthoritativeTeam
}>

/**
 * The backend validates all member IDs, rejects duplicate membership, and ensures
 * a non-null lead belongs to the same team. Member deletion must remove its team
 * references (including leadId) atomically. Organization/team-management authority
 * is enforced server-side according to product policy; this contract grants no role bypass.
 */
export interface TeamApiContract {
  listTeams(query: ListTeamsQuery): Promise<ListTeamsResponse>
  getTeam(teamId: string): Promise<GetTeamResponse>
  createTeam(input: CreateTeamRequest): Promise<CreateTeamResponse>
  updateTeam(input: UpdateTeamRequest): Promise<UpdateTeamResponse>
  deleteTeam(input: DeleteTeamRequest): Promise<DeleteTeamResponse>
  addTeamMember(input: AddTeamMemberRequest): Promise<TeamMembershipMutationResponse>
  removeTeamMember(input: RemoveTeamMemberRequest): Promise<TeamMembershipMutationResponse>
  setTeamLead(input: SetTeamLeadRequest): Promise<TeamMembershipMutationResponse>
}
