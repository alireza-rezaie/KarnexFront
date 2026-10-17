import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMembers } from '@/contexts/MembersContext'
import type {
  CreateTeamInput,
  Team,
  TeamCapabilities,
  TeamDisplayCopy,
  TeamMutationResult,
  UpdateTeamInput,
} from '@/types/team'

export type {
  CreateTeamInput,
  TeamCapabilities,
  TeamDisplayCopy,
  TeamMutationResult,
  UpdateTeamInput,
} from '@/types/team'

const initialTeams: Team[] = []

export type TeamsContextValue = {
  teams: Team[]
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  capabilities: TeamCapabilities
  displayCopy: TeamDisplayCopy
  createTeam?: (input: CreateTeamInput) => Promise<TeamMutationResult>
  updateTeam?: (teamId: Team['id'], updates: UpdateTeamInput) => Promise<TeamMutationResult>
  addMemberToTeam?: (teamId: Team['id'], memberId: string) => Promise<TeamMutationResult>
  removeMemberFromTeam?: (teamId: Team['id'], memberId: string) => Promise<TeamMutationResult>
  setTeamLead?: (teamId: Team['id'], memberId: string | undefined) => Promise<TeamMutationResult>
  removeTeamsByIds: (teamIds: Team['id'][]) => Promise<TeamMutationResult>
}

const TeamsContext = createContext<TeamsContextValue | undefined>(undefined)
const isTestRuntime = import.meta.env.MODE === 'test'
const runtimeCapabilities: TeamCapabilities = {
  canCreateTeam: true,
  canUpdateTeam: true,
  canAddTeamMember: true,
  canRemoveTeamMember: true,
  canSetTeamLead: true,
}
const unavailableCopy: TeamDisplayCopy = {
  serviceUnavailable: 'تیم‌ها پس از اتصال سرویس مدیریت تیم قابل مدیریت هستند.',
  actionUnavailable: 'این عملیات پس از اتصال سرویس مدیریت تیم در دسترس خواهد بود.',
  loading: 'در حال دریافت اطلاعات تیم‌ها…',
}

export function TeamsProvider({ children }: { children: ReactNode }) {
  // Production starts empty; teams are added only by explicit runtime mutations.
  const [teams, setTeams] = useState<Team[]>(() => import.meta.env.MODE === 'test'
    ? ((globalThis as { __karnexTestFixtures?: { teams: Team[] } }).__karnexTestFixtures?.teams ?? [])
    : initialTeams)
  const { members } = useMembers()
  const memberExists = useCallback((memberId: string) => members.some((member) => member.id === memberId), [members])
  const normalizeName = (name: string) => name.trim().toLocaleLowerCase()
  const uniqueMemberIds = (memberIds: string[]) => [...new Set(memberIds)]
  useEffect(() => {
    const validIds = new Set(members.map((member) => member.id))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeams((current) => current.map((team) => ({ ...team, memberIds: team.memberIds.filter((id) => validIds.has(id)), ...(team.leadId && !validIds.has(team.leadId) ? { leadId: undefined } : {}) })))
  }, [members])

  const createTeam = useCallback(async (input: CreateTeamInput): Promise<TeamMutationResult> => {
    const name = input.name.trim()
    const memberIds = uniqueMemberIds(input.memberIds ?? [])
    const leadId = input.leadId
    if (!name || teams.some((team) => normalizeName(team.name) === normalizeName(name)) || !memberIds.every(memberExists) || (leadId !== undefined && !memberExists(leadId))) {
      return { ok: false, message: 'نام تیم یا اعضای انتخاب‌شده معتبر نیستند.' }
    }
    const team: Team = {
      id: `team-${crypto.randomUUID()}`,
      name,
      description: input.description,
      leadId,
      memberIds: leadId && !memberIds.includes(leadId) ? [...memberIds, leadId] : memberIds,
      activity: 'همین حالا',
      tone: 'blue',
    }
    setTeams((current) => [...current, team])
    return { ok: true, team }
  }, [memberExists, teams])
  const updateTeam = useCallback(async (teamId: Team['id'], updates: UpdateTeamInput): Promise<TeamMutationResult> => {
    const team = teams.find((item) => item.id === teamId)
    if (!team) return { ok: false, message: 'تیم مورد نظر پیدا نشد.' }
    const name = updates.name === undefined ? team.name : updates.name.trim()
    const memberIds = updates.memberIds === undefined ? team.memberIds : uniqueMemberIds(updates.memberIds)
    const leadId = updates.leadId === undefined ? team.leadId : updates.leadId
    if (!name || teams.some((item) => item.id !== teamId && normalizeName(item.name) === normalizeName(name)) || !memberIds.every(memberExists) || (leadId !== undefined && !memberExists(leadId))) {
      return { ok: false, message: 'نام تیم یا اعضای انتخاب‌شده معتبر نیستند.' }
    }
    const nextTeam: Team = {
      ...team,
      ...updates,
      name,
      memberIds: leadId && !memberIds.includes(leadId) ? [...memberIds, leadId] : memberIds,
      leadId,
    }
    setTeams((current) => current.map((item) => item.id === teamId ? nextTeam : item))
    return { ok: true, team: nextTeam }
  }, [memberExists, teams])
  const addMemberToTeam = useCallback(async (teamId: Team['id'], memberId: string): Promise<TeamMutationResult> => {
    const team = teams.find((item) => item.id === teamId)
    if (!team || !memberExists(memberId) || team.memberIds.includes(memberId)) return { ok: false, message: 'این عضو معتبر نیست یا قبلاً در تیم حضور دارد.' }
    setTeams((current) => current.map((item) => item.id === teamId ? { ...item, memberIds: [...item.memberIds, memberId] } : item))
    return { ok: true }
  }, [memberExists, teams])
  const removeMemberFromTeam = useCallback(async (teamId: Team['id'], memberId: string): Promise<TeamMutationResult> => {
    const team = teams.find((item) => item.id === teamId)
    if (!team || !team.memberIds.includes(memberId)) return { ok: false, message: 'عضو مورد نظر در این تیم حضور ندارد.' }
    setTeams((current) => current.map((item) => item.id === teamId ? {
      ...item,
      memberIds: item.memberIds.filter((currentMemberId) => currentMemberId !== memberId),
      ...(item.leadId === memberId ? { leadId: undefined } : {}),
    } : item))
    return { ok: true }
  }, [teams])
  const setTeamLead = useCallback(async (teamId: Team['id'], memberId: string | undefined): Promise<TeamMutationResult> => {
    const team = teams.find((item) => item.id === teamId)
    if (!team || (memberId !== undefined && !memberExists(memberId))) return { ok: false, message: 'سرپرست انتخاب‌شده معتبر نیست.' }
    if (team.leadId === memberId && (memberId === undefined || team.memberIds.includes(memberId))) return { ok: false, message: 'تغییری برای ذخیره وجود ندارد.' }
    setTeams((current) => current.map((item) => item.id === teamId ? {
      ...item,
      leadId: memberId,
      memberIds: memberId && !item.memberIds.includes(memberId) ? [...item.memberIds, memberId] : item.memberIds,
    } : item))
    return { ok: true }
  }, [memberExists, teams])
  const removeTeamsByIds = useCallback(async (teamIds: Team['id'][]): Promise<TeamMutationResult> => {
    const ids = new Set(teamIds)
    if (!ids.size || !teams.some((team) => ids.has(team.id))) return { ok: false, message: 'تیمی برای حذف پیدا نشد.' }
    setTeams((current) => current.filter((team) => !ids.has(team.id)))
    return { ok: true }
  }, [teams])
  const value = useMemo(
    (): TeamsContextValue => isTestRuntime
      ? {
          teams,
          serviceAvailable: true,
          loading: false,
          error: null,
          capabilities: { canCreateTeam: true, canUpdateTeam: true, canAddTeamMember: true, canRemoveTeamMember: true, canSetTeamLead: true },
          displayCopy: unavailableCopy,
          createTeam,
          updateTeam,
          addMemberToTeam,
          removeMemberFromTeam,
          setTeamLead,
          removeTeamsByIds,
        }
      : {
          teams,
          serviceAvailable: true,
          loading: false,
          error: null,
          capabilities: runtimeCapabilities,
          displayCopy: unavailableCopy,
          createTeam,
          updateTeam,
          addMemberToTeam,
          removeMemberFromTeam,
          setTeamLead,
          removeTeamsByIds,
        },
    [addMemberToTeam, createTeam, removeMemberFromTeam, removeTeamsByIds, setTeamLead, teams, updateTeam],
  )
  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTeams() {
  const context = useContext(TeamsContext)
  if (!context) throw new Error('useTeams must be used within a TeamsProvider.')
  return context
}
