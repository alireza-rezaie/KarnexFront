import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { CurrentUserProvider, useCurrentUser } from '@/contexts/CurrentUserContext'
import { MembersProvider, useMembers } from '@/contexts/MembersContext'

function RuntimeWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider><MembersProvider><CurrentUserProvider>{children}</CurrentUserProvider></MembersProvider></AuthProvider>
}

function useRuntimeIdentity() {
  return { auth: useAuth(), members: useMembers(), currentUser: useCurrentUser() }
}

describe('frontend runtime authentication', () => {
  it('creates an explicit account, matching Member and active session without browser storage', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useRuntimeIdentity(), { wrapper: RuntimeWrapper })

    expect(result.current.auth.session).toBeNull()
    expect(result.current.currentUser.currentMember).toBeNull()

    await act(async () => {
      expect(await result.current.auth.register?.({
        firstName: 'کاربر',
        lastName: 'واقعی',
        username: 'runtime-user',
        phone: '09120000000',
        email: 'runtime@example.test',
        password: 'Runtime!123',
      })).toEqual({ ok: true, nextPath: '/dashboard' })
    })

    await waitFor(() => expect(result.current.currentUser.currentMember?.id).toMatch(/^runtime-user-/))
    const id = result.current.auth.currentUserId
    expect(result.current.currentUser.currentMember).toMatchObject({
      id,
      name: 'کاربر واقعی',
      email: 'runtime@example.test',
      avatarId: null,
    })
    expect(result.current.members.members.some((member) => member.id === id)).toBe(true)
    expect(storageWrite).not.toHaveBeenCalled()
    storageWrite.mockRestore()
  })

  it('restores only a runtime-created account after logout and retains its Member profile in memory', async () => {
    const { result } = renderHook(() => useRuntimeIdentity(), { wrapper: RuntimeWrapper })

    await act(async () => {
      await result.current.auth.register?.({
        firstName: 'کاربر', lastName: 'آواتار', username: 'avatar-user', phone: '09120000001', email: 'avatar@example.test', password: 'Avatar!123',
      })
    })
    await waitFor(() => expect(result.current.currentUser.currentMember).not.toBeNull())

    await act(async () => {
      expect(await result.current.currentUser.updateCurrentMember({ avatarId: 'avatar-06' })).toEqual({ ok: true })
      expect(await result.current.auth.logout?.()).toEqual({ ok: true, nextPath: '/login' })
    })
    expect(result.current.auth.currentUserId).toBeNull()
    expect(result.current.currentUser.currentMember).toBeNull()

    await act(async () => {
      expect(await result.current.auth.login?.({ username: 'avatar@example.test', password: 'Avatar!123' })).toEqual({ ok: true, nextPath: '/dashboard' })
    })
    await waitFor(() => expect(result.current.currentUser.currentMember).toMatchObject({
      email: 'avatar@example.test', avatarId: 'avatar-06',
    }))
  })

  it('assigns account-level system admin only to the first runtime account and preserves it across login', async () => {
    const { result } = renderHook(() => useRuntimeIdentity(), { wrapper: RuntimeWrapper })

    await act(async () => {
      await result.current.auth.register?.({ firstName: 'اول', lastName: 'سیستم', username: 'first-admin', phone: '09120000002', email: 'first@local.test', password: 'Runtime!123' })
    })
    await waitFor(() => expect(result.current.auth.currentAccount?.accountRole).toBe('system-admin'))
    const firstId = result.current.auth.currentUserId!
    expect(result.current.auth.isSystemAdmin).toBe(true)

    await act(async () => {
      await result.current.auth.register?.({ firstName: 'دوم', lastName: 'کاربر', username: 'second-user', phone: '09120000003', email: 'second@local.test', password: 'Runtime!123' })
    })
    await waitFor(() => expect(result.current.auth.currentAccount?.accountRole).toBe('user'))
    const secondId = result.current.auth.currentUserId!
    expect(result.current.auth.isSystemAdmin).toBe(false)

    await act(async () => {
      expect(await result.current.members.updateMember?.(secondId, { roleId: 'pm' })).toEqual({ ok: true })
    })
    expect(result.current.members.members.find((member) => member.id === secondId)?.roleId).toBe('pm')
    expect(result.current.auth.isSystemAdmin).toBe(false)

    await act(async () => {
      await result.current.auth.logout?.()
      await result.current.auth.login?.({ username: 'first-admin', password: 'Runtime!123' })
    })
    await waitFor(() => expect(result.current.auth.currentUserId).toBe(firstId))
    expect(result.current.auth.currentAccount?.accountRole).toBe('system-admin')
    expect(result.current.auth.isSystemAdmin).toBe(true)
  })

  it('lets only a system admin create a runtime account without replacing the active session', async () => {
    const { result } = renderHook(() => useRuntimeIdentity(), { wrapper: RuntimeWrapper })

    await act(async () => {
      await result.current.auth.register?.({ firstName: 'مدیر', lastName: 'سامانه', username: 'system-admin', phone: '09120000004', email: 'admin@local.test', password: 'Runtime!123' })
    })
    await waitFor(() => expect(result.current.auth.isSystemAdmin).toBe(true))
    const adminId = result.current.auth.currentUserId

    await act(async () => {
      expect(await result.current.auth.createRuntimeAccount?.({ firstName: 'کاربر', lastName: 'دوم', username: 'managed-user', phone: '09120000005', email: 'managed@local.test', password: 'Runtime!123' })).toMatchObject({ ok: true, account: { accountRole: 'user', username: 'managed-user' } })
    })
    expect(result.current.auth.currentUserId).toBe(adminId)
    expect(result.current.auth.runtimeAccounts?.find((account) => account.username === 'managed-user')?.id).toBe(result.current.members.members.find((member) => member.email === 'managed@local.test')?.id)

    await act(async () => {
      expect(await result.current.auth.createRuntimeAccount?.({ firstName: 'تکراری', lastName: 'نام', username: 'managed-user', phone: '09120000006', email: 'other@local.test', password: 'Runtime!123' })).toMatchObject({ ok: false })
      await result.current.auth.logout?.()
      await result.current.auth.login?.({ username: 'managed-user', password: 'Runtime!123' })
    })
    await waitFor(() => expect(result.current.auth.currentUserId).not.toBe(adminId))
    expect(result.current.auth.isSystemAdmin).toBe(false)
    await expect(result.current.auth.createRuntimeAccount?.({ firstName: 'نباید', lastName: 'ایجاد شود', username: 'blocked-user', phone: '09120000007', email: 'blocked@local.test', password: 'Runtime!123' })).resolves.toMatchObject({ ok: false })
  })

  it('allows a system admin to edit and disable another account while preserving its member identity', async () => {
    const { result } = renderHook(() => useRuntimeIdentity(), { wrapper: RuntimeWrapper })
    await act(async () => {
      await result.current.auth.register?.({ firstName: 'مدیر', lastName: 'چرخه', username: 'lifecycle-admin', phone: '09120000008', email: 'lifecycle-admin@local.test', password: 'Runtime!123' })
    })
    await waitFor(() => expect(result.current.auth.isSystemAdmin).toBe(true))
    const adminId = result.current.auth.currentUserId
    let userId = ''
    await act(async () => {
      const created = await result.current.auth.createRuntimeAccount?.({ firstName: 'کاربر', lastName: 'قدیمی', username: 'lifecycle-user', phone: '09120000009', email: 'lifecycle-user@local.test', password: 'Runtime!123' })
      expect(created).toMatchObject({ ok: true })
      userId = created && created.ok ? created.account.id : ''
    })
    await waitFor(() => expect(result.current.auth.runtimeAccounts?.some((account) => account.id === userId)).toBe(true))
    await act(async () => {
      expect(await result.current.auth.updateRuntimeAccount?.(userId, { firstName: 'کاربر', lastName: 'ویرایش‌شده', username: 'lifecycle-user', email: 'lifecycle-user@local.test', phone: '09120000010' })).toMatchObject({ ok: true, account: { id: userId, isActive: true } })
    })
    await waitFor(() => expect(result.current.auth.runtimeAccounts?.find((account) => account.id === userId)?.lastName).toBe('ویرایش‌شده'))
    await act(async () => {
      expect(await result.current.auth.setRuntimeAccountActive?.(userId, false)).toMatchObject({ ok: true, account: { isActive: false } })
    })
    expect(result.current.auth.currentUserId).toBe(adminId)
    expect(result.current.members.members.find((member) => member.id === userId)?.name).toBe('کاربر ویرایش‌شده')

    await act(async () => {
      await result.current.auth.logout?.()
      expect(await result.current.auth.login?.({ username: 'lifecycle-user', password: 'Runtime!123' })).toMatchObject({ ok: false, message: 'این حساب کاربری غیرفعال است.' })
      await result.current.auth.login?.({ username: 'lifecycle-admin', password: 'Runtime!123' })
    })
    await waitFor(() => expect(result.current.auth.currentUserId).toBe(adminId))
    await act(async () => {
      expect(await result.current.auth.setRuntimeAccountActive?.(adminId!, false)).toMatchObject({ ok: false })
      expect(await result.current.auth.setRuntimeAccountActive?.(userId, true)).toMatchObject({ ok: true, account: { isActive: true } })
    })
    await waitFor(() => expect(result.current.auth.runtimeAccounts?.find((account) => account.id === userId)?.isActive).toBe(true))
    await act(async () => {
      await result.current.auth.logout?.()
      expect(await result.current.auth.login?.({ username: 'lifecycle-user', password: 'Runtime!123' })).toMatchObject({ ok: true })
    })
  })
})
