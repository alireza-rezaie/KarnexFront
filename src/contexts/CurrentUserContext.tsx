import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useMembers } from '@/contexts/MembersContext'
import type { Member, MemberMutationResult } from '@/types/member'

type CurrentUserContextValue = {
  currentMember: Member | null
  updateCurrentMember: (updates: Partial<Omit<Member, 'id'>>) => Promise<MemberMutationResult>
}

const CurrentUserContext = createContext<CurrentUserContextValue | undefined>(undefined)

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { currentUserId } = useAuth()
  const { members, updateMember } = useMembers()
  const currentMember = useMemo(() => {
    if (!currentUserId) return null

    return members.find((member) => member.id === currentUserId) ?? null
  }, [currentUserId, members])
  const updateCurrentMember = useCallback(async (updates: Partial<Omit<Member, 'id'>>): Promise<MemberMutationResult> => {
    if (!currentMember) {
      return { ok: false, message: 'کاربر فعلی در دسترس نیست' }
    }

    if (!updateMember) return { ok: false, message: 'ویرایش پروفایل پس از اتصال سرویس اعضا در دسترس خواهد بود.' }
    return updateMember(currentMember.id, updates)
  }, [currentMember, updateMember])
  const value = useMemo(
    () => ({ currentMember, updateCurrentMember }),
    [currentMember, updateCurrentMember],
  )

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentUser() {
  const context = useContext(CurrentUserContext)

  if (!context) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider.')
  }

  return context
}
