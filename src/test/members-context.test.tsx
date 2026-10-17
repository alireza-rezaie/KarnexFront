import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { MembersProvider, useMembers } from '@/contexts/MembersContext'
import { ProjectsProvider } from '@/contexts/ProjectsContext'
import { RolesProvider } from '@/contexts/RolesContext'
import MembersPage from '@/pages/MembersPage'

function MembersWrapper({ children }: { children: ReactNode }) {
  return <MembersProvider>{children}</MembersProvider>
}

describe('MembersContext', () => {
  it('blocks case-insensitive duplicate emails for updates and adding members', async () => {
    const { result } = renderHook(() => useMembers(), { wrapper: MembersWrapper })
    const originalSecondMember = result.current.members.find((member) => member.id === 'm2')

    await act(async () => {
      expect((await result.current.updateMember?.('m2', { email: ' ALI@KARNEX.IR ' }))?.ok).toBe(false)
      expect((await result.current.addMember?.({
        name: 'عضو جدید',
        email: 'Ali@Karnex.ir',
        jobTitle: 'توسعه‌دهنده',
      }))?.ok).toBe(false)
    })

    expect(result.current.members.find((member) => member.id === 'm2')).toEqual(originalSecondMember)
  })

  it('updates a valid member without changing unrelated members', async () => {
    const { result } = renderHook(() => useMembers(), { wrapper: MembersWrapper })
    const unrelatedMember = result.current.members.find((member) => member.id === 'm3')

    await act(async () => {
      expect((await result.current.updateMember?.('m2', { name: 'سارا جدید', email: 'sara.new@karnex.ir' }))?.ok).toBe(true)
    })

    expect(result.current.members.find((member) => member.id === 'm2')).toMatchObject({
      name: 'سارا جدید',
      email: 'sara.new@karnex.ir',
    })
    expect(result.current.members.find((member) => member.id === 'm3')).toEqual(unrelatedMember)
  })

  it('resolves member project IDs to project names in the member profile', async () => {
    render(<MemoryRouter><AuthProvider><MembersProvider><RolesProvider><ProjectsProvider><MembersPage /></ProjectsProvider></RolesProvider></MembersProvider></AuthProvider></MemoryRouter>)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'گزینه‌های علی احمدی' }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'مشاهده پروفایل' }))

    expect(screen.getByText('بازطراحی وب‌سایت، اپلیکیشن موبایل')).toBeTruthy()
    expect(screen.queryByText('p1، p2')).toBeNull()
    expect(screen.queryByRole('button', { name: 'افزودن عضو' })).toBeNull()
  })
})
