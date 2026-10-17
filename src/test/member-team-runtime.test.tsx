import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MembersProvider, useMembers } from '@/contexts/MembersContext'
import { TeamsProvider, useTeams } from '@/contexts/TeamsContext'

function RuntimeWrapper({ children }: { children: ReactNode }) {
  return <MembersProvider><TeamsProvider>{children}</TeamsProvider></MembersProvider>
}

function useRuntimeStores() {
  return { members: useMembers(), teams: useTeams() }
}

describe('frontend member and team runtime CRUD', () => {
  it('creates a direct session member and manages its team membership without browser storage', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useRuntimeStores(), { wrapper: RuntimeWrapper })
    let memberId = ''
    let teamId = ''

    await act(async () => {
      expect(await result.current.members.addMember?.({
        name: 'عضو runtime', email: 'member.runtime@example.test', jobTitle: 'توسعه‌دهنده',
      })).toEqual({ ok: true })
    })
    memberId = result.current.members.members.find((member) => member.email === 'member.runtime@example.test')?.id ?? ''
    expect(memberId).toMatch(/^member-/)

    await act(async () => {
      const creation = await result.current.teams.createTeam?.({ name: 'تیم runtime', memberIds: [memberId] })
      expect(creation?.ok).toBe(true)
      teamId = creation?.ok ? creation.team?.id ?? '' : ''
    })
    await act(async () => {
      expect(await result.current.teams.updateTeam?.(teamId, { name: 'تیم runtime ویرایش‌شده' })).toMatchObject({ ok: true })
    })
    await act(async () => {
      expect(await result.current.teams.addMemberToTeam?.(teamId, 'm1')).toEqual({ ok: true })
    })
    await act(async () => {
      expect(await result.current.teams.removeMemberFromTeam?.(teamId, 'm1')).toEqual({ ok: true })
    })

    expect(result.current.teams.teams.find((team) => team.id === teamId)).toMatchObject({
      name: 'تیم runtime ویرایش‌شده', memberIds: [memberId],
    })
    expect(storageWrite).not.toHaveBeenCalled()
    storageWrite.mockRestore()
  })
})
