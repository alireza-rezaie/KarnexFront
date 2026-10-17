import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { MembersProvider } from '@/contexts/MembersContext'
import { TeamsProvider, useTeams } from '@/contexts/TeamsContext'

function TeamsWrapper({ children }: { children: ReactNode }) {
  return <MembersProvider><TeamsProvider>{children}</TeamsProvider></MembersProvider>
}

describe('TeamsContext', () => {
  it('blocks duplicate names and invalid member or lead IDs', async () => {
    const { result } = renderHook(() => useTeams(), { wrapper: TeamsWrapper })

    await act(async () => {
      expect((await result.current.createTeam?.({ name: ' تیم توسعه ' }))?.ok).toBe(false)
      expect((await result.current.createTeam?.({ name: 'جدید', memberIds: ['unknown'] }))?.ok).toBe(false)
      expect((await result.current.createTeam?.({ name: 'جدید', leadId: 'unknown' }))?.ok).toBe(false)
    })
  })

  it('adds a valid lead, deduplicates members, and clears the lead when removed', async () => {
    const { result } = renderHook(() => useTeams(), { wrapper: TeamsWrapper })
    let teamId = ''

    await act(async () => {
      const resultValue = await result.current.createTeam?.({
        name: 'تیم محصول',
        memberIds: ['m2', 'm2'],
        leadId: 'm1',
      })
      teamId = resultValue?.ok ? resultValue.team?.id ?? '' : ''
    })

    expect(teamId).not.toBe('')
    expect(result.current.teams.find((team) => team.id === teamId)?.memberIds).toEqual(['m2', 'm1'])

    await act(async () => {
      expect((await result.current.removeMemberFromTeam?.(teamId, 'm1'))?.ok).toBe(true)
    })

    const team = result.current.teams.find((currentTeam) => currentTeam.id === teamId)
    expect(team?.leadId).toBeUndefined()
    expect(team?.memberIds).toEqual(['m2'])
  })
})
