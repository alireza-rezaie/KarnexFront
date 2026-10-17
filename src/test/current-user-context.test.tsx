import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import { CurrentUserProvider, useCurrentUser } from '@/contexts/CurrentUserContext'
import { MembersProvider } from '@/contexts/MembersContext'

function authValue(currentUserId: string | null): AuthContextValue {
  return {
    serviceAvailable: true,
    loading: false,
    error: null,
    authenticated: currentUserId !== null,
    session: currentUserId ? { id: 'test-session', userId: currentUserId } : null,
    currentUserId,
    currentAccount: null,
    isSystemAdmin: false,
    capabilities: {
      canLogin: false,
      canRegister: false,
      canVerifyOtp: false,
      canRequestPasswordReset: false,
      canLogout: false,
    },
    displayCopy: {
      serviceUnavailable: 'سرویس احراز هویت هنوز متصل نیست.',
      actionUnavailable: 'این عملیات پس از اتصال سرویس احراز هویت در دسترس خواهد بود.',
      loading: 'در حال ارتباط با سرویس احراز هویت…',
    },
  }
}

function Wrapper({ children, currentUserId }: { children: ReactNode; currentUserId: string | null }) {
  return (
    <AuthContext.Provider value={authValue(currentUserId)}>
      <MembersProvider>
        <CurrentUserProvider>{children}</CurrentUserProvider>
      </MembersProvider>
    </AuthContext.Provider>
  )
}

describe('CurrentUserContext identity resolution', () => {
  it('returns null without an authenticated user ID', () => {
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: ({ children }) => <Wrapper currentUserId={null}>{children}</Wrapper>,
    })

    expect(result.current.currentMember).toBeNull()
  })

  it('returns null when AuthContext references an unknown Member', () => {
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: ({ children }) => <Wrapper currentUserId="unknown-member">{children}</Wrapper>,
    })

    expect(result.current.currentMember).toBeNull()
  })

  it('resolves only the Member identified by AuthContext', () => {
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: ({ children }) => <Wrapper currentUserId="m1">{children}</Wrapper>,
    })

    expect(result.current.currentMember?.id).toBe('m1')
  })

  it('updates the authenticated member in session memory without browser storage', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: ({ children }) => <Wrapper currentUserId="m1">{children}</Wrapper>,
    })

    await act(async () => {
      expect(await result.current.updateCurrentMember({
        name: 'علی به‌روزشده',
        email: 'ali.updated@karnex.ir',
        avatarId: 'avatar-08',
      })).toEqual({ ok: true })
    })

    expect(result.current.currentMember).toMatchObject({
      id: 'm1',
      name: 'علی به‌روزشده',
      email: 'ali.updated@karnex.ir',
      avatarId: 'avatar-08',
    })
    expect(storageWrite).not.toHaveBeenCalled()
    storageWrite.mockRestore()
  })
})
