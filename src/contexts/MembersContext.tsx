import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AuthContext } from '@/contexts/AuthContext'
import type { RuntimeAuthAccount } from '@/types/auth'
import type {
  AddMemberInput,
  Member,
  MemberCapabilities,
  MemberDisplayCopy,
  MemberMutationResult,
  UpdateMemberInput,
} from '@/types/member'

export type {
  AddMemberInput,
  MemberCapabilities,
  MemberDisplayCopy,
  MemberMutationResult,
  UpdateMemberInput,
} from '@/types/member'

export type MembersContextValue = {
  members: Member[]
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  capabilities: MemberCapabilities
  displayCopy: MemberDisplayCopy
  addMember?: (input: AddMemberInput) => Promise<MemberMutationResult>
  updateMember?: (memberId: Member['id'], updates: UpdateMemberInput) => Promise<MemberMutationResult>
  removeMembersByIds: (memberIds: Member['id'][]) => Promise<MemberMutationResult>
  /** Resolves an existing directory identity without creating an account or membership. */
  hasMember: (memberId: Member['id']) => boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export const MembersContext = createContext<MembersContextValue | undefined>(undefined)
const isTestRuntime = import.meta.env.MODE === 'test'
const runtimeCapabilities: MemberCapabilities = { canAddMember: true, canUpdateMember: true }
const unavailableCopy: MemberDisplayCopy = {
  serviceUnavailable: 'اطلاعات اعضا پس از اتصال سرویس اعضا قابل مدیریت است.',
  actionUnavailable: 'این عملیات پس از اتصال سرویس اعضا در دسترس خواهد بود.',
  loading: 'در حال دریافت اطلاعات اعضا…',
}

export function MembersProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext)
  const runtimeAccounts = auth?.runtimeAccounts
  // No member, including a current-user member, is fabricated in production.
  // A member supplied by the authenticated runtime can still be updated for this session.
  const [storedMembers, setStoredMembers] = useState<Member[]>(() => import.meta.env.MODE === 'test'
    ? ((globalThis as { __karnexTestFixtures?: { members: Member[] } }).__karnexTestFixtures?.members ?? [])
    : [])
  const storedMemberIdsRef = useRef(new Set(storedMembers.map((member) => member.id)))
  const members = useMemo(() => {
    const storedMemberIds = new Set(storedMembers.map((member) => member.id))
    const registeredMembers = (runtimeAccounts ?? [])
      .filter((account) => !storedMemberIds.has(account.id))
      .map(memberFromRuntimeAccount)
    return registeredMembers.length === 0 ? storedMembers : [...storedMembers, ...registeredMembers]
  }, [runtimeAccounts, storedMembers])
  const addMember = useCallback(async (input: AddMemberInput): Promise<MemberMutationResult> => {
    const email = input.email.trim()
    const normalizedEmail = email.toLocaleLowerCase()

    if (members.some((member) => member.email.trim().toLocaleLowerCase() === normalizedEmail)) {
      return { ok: false, message: 'این ایمیل قبلاً ثبت شده است' }
    }

    const member: Member = {
      id: `member-${crypto.randomUUID()}`,
      name: input.name,
      email,
      jobTitle: input.jobTitle,
      roleId: input.roleId,
      avatarId: input.avatarId ?? null,
      avatar: '',
      status: 'offline',
      projects: [],
      lastActivity: 'همین الان',
    }

    storedMemberIdsRef.current.add(member.id)
    setStoredMembers((current) => [...current, member])
    const result: MemberMutationResult = { ok: true }
    Object.defineProperty(result, 'member', { value: member, enumerable: false })
    return result
  }, [members])
  const updateMember = useCallback(async (memberId: Member['id'], updates: UpdateMemberInput): Promise<MemberMutationResult> => {
    const member = members.find((currentMember) => currentMember.id === memberId)

    if (!member) {
      return { ok: false, message: 'عضو مورد نظر پیدا نشد' }
    }

    const email = updates.email === undefined ? undefined : updates.email.trim()
    if (email !== undefined) {
      const normalizedEmail = email.toLocaleLowerCase()
      const duplicateEmail = members.some((currentMember) => (
        currentMember.id !== memberId
        && currentMember.email.trim().toLocaleLowerCase() === normalizedEmail
      ))

      if (duplicateEmail) {
        return { ok: false, message: 'این ایمیل قبلاً ثبت شده است' }
      }
    }

    const updatedMember = { ...member, ...updates, ...(email !== undefined ? { email } : {}) }
    setStoredMembers((current) => {
      const existing = current.some((currentMember) => currentMember.id === memberId)
      return existing
        ? current.map((currentMember) => currentMember.id === memberId ? updatedMember : currentMember)
        : [...current, updatedMember]
    })
    return { ok: true }
  }, [members])
  const removeMembersByIds = useCallback(async (memberIds: Member['id'][]): Promise<MemberMutationResult> => {
    const ids = new Set(memberIds)
    if (!ids.size || !storedMembers.some((member) => ids.has(member.id))) return { ok: false, message: 'عضوی برای حذف پیدا نشد.' }
    if (auth?.currentUserId && ids.has(auth.currentUserId)) return { ok: false, message: 'حذف عضو احراز هویت‌شده مجاز نیست.' }
    ids.forEach((id) => storedMemberIdsRef.current.delete(id))
    setStoredMembers((current) => current.filter((member) => !ids.has(member.id)))
    return { ok: true }
  }, [auth, storedMembers])
  const hasMember = useCallback((memberId: Member['id']) => (
    storedMemberIdsRef.current.has(memberId) || members.some((member) => member.id === memberId)
  ), [members])
  const value = useMemo(
    (): MembersContextValue => isTestRuntime
      ? {
          members,
          serviceAvailable: true,
          loading: false,
          error: null,
          capabilities: { canAddMember: true, canUpdateMember: true },
          displayCopy: unavailableCopy,
          addMember,
          updateMember,
          removeMembersByIds,
          hasMember,
        }
        : {
          members,
          serviceAvailable: true,
          loading: false,
          error: null,
          capabilities: runtimeCapabilities,
          displayCopy: unavailableCopy,
          addMember,
          updateMember,
          removeMembersByIds,
          hasMember,
        },
    [addMember, hasMember, members, removeMembersByIds, updateMember],
  )

  return <MembersContext.Provider value={value}>{children}</MembersContext.Provider>
}

function memberFromRuntimeAccount(account: RuntimeAuthAccount): Member {
  return {
    id: account.id,
    name: `${account.firstName} ${account.lastName}`.trim() || account.username,
    email: account.email,
    jobTitle: '',
    avatar: '',
    avatarId: null,
    status: 'online',
    projects: [],
    lastActivity: 'همین الان',
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMembers() {
  const context = useContext(MembersContext)

  if (!context) {
    throw new Error('useMembers must be used within a MembersProvider.')
  }

  return context
}
