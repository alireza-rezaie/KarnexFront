import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { MembersProvider, useMembers } from '@/contexts/MembersContext'
import { ProjectsProvider, useProjects } from '@/contexts/ProjectsContext'
import { getProjectMemberRole } from '@/types/project'

function AccessWrapper({ children, userId = 'm1' }: { children: ReactNode; userId?: string }) {
  return <AuthenticatedTestProvider userId={userId}><MembersProvider><ProjectsProvider>{children}</ProjectsProvider></MembersProvider></AuthenticatedTestProvider>
}

function useAccessRuntime() {
  return { projects: useProjects(), members: useMembers() }
}

describe('project access runtime', () => {
  it('allows a project manager to add an existing member, change their role, and remove project access without localStorage', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useAccessRuntime(), { wrapper: AccessWrapper })

    await act(async () => {
      expect((await result.current.projects.addProjectMember?.('p1', { memberId: 'm8', roleId: 'sm' }))?.ok).toBe(true)
    })
    expect(result.current.projects.projects.find((project) => project.id === 'p1')?.members).toContain('m8')
    expect(result.current.members.members.find((member) => member.id === 'm8')?.roleId).toBeUndefined()
    expect(result.current.projects.projects.find((project) => project.id === 'p1')?.memberRoles?.m8).toBe('sm')

    await act(async () => {
      expect((await result.current.projects.updateProjectMemberAccess?.('p1', { memberId: 'm8', roleId: 'pm' }))?.ok).toBe(true)
      expect((await result.current.projects.removeProjectMember?.('p1', 'm8'))?.ok).toBe(true)
    })
    expect(result.current.projects.projects.find((project) => project.id === 'p1')?.members).not.toContain('m8')
    expect(storage).not.toHaveBeenCalled()
  })

  it('keeps roles and membership isolated per project for the same directory member', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper: AccessWrapper })

    await act(async () => {
      expect((await result.current.updateProjectMemberAccess?.('p1', { memberId: 'm1', roleId: 'sm' }))?.ok).toBe(true)
      expect((await result.current.updateProjectMemberAccess?.('p2', { memberId: 'm1', roleId: 'pm' }))?.ok).toBe(true)
    })

    const first = result.current.projects.find((project) => project.id === 'p1')
    const second = result.current.projects.find((project) => project.id === 'p2')
    expect(first?.memberRoles?.m1).toBe('sm')
    expect(second?.memberRoles?.m1).toBe('pm')
    expect(result.current.canManageProjectAccess('p1')).toBe(true)
    expect(result.current.canManageProjectAccess('p2')).toBe(true)

    await act(async () => {
      expect((await result.current.removeProjectMember?.('p1', 'm1'))?.ok).toBe(true)
    })
    expect(result.current.projects.find((project) => project.id === 'p1')?.members).not.toContain('m1')
    expect(result.current.projects.find((project) => project.id === 'p2')?.members).toContain('m1')
  })

  it('does not create an Auth account or project access when adding a directory member', async () => {
    function AccountWrapper({ children }: { children: ReactNode }) {
      return <AuthProvider><MembersProvider><ProjectsProvider>{children}</ProjectsProvider></MembersProvider></AuthProvider>
    }
    const { result } = renderHook(() => ({ auth: useAuth(), members: useMembers(), projects: useProjects() }), { wrapper: AccountWrapper })

    await act(async () => {
      expect((await result.current.members.addMember?.({ name: 'عضو مستقل', email: 'independent@karnex.local', jobTitle: '', avatarId: null }))?.ok).toBe(true)
    })

    const member = result.current.members.members.find((item) => item.email === 'independent@karnex.local')
    expect(member).toBeDefined()
    expect(result.current.auth.runtimeAccounts).toHaveLength(0)
    expect(result.current.projects.projects.every((project) => !project.members.includes(member!.id))).toBe(true)
  })

  it('does not inherit a directory role for a newly created project without an explicit project role', async () => {
    function AccountWrapper({ children }: { children: ReactNode }) {
      return <AuthProvider><MembersProvider><ProjectsProvider>{children}</ProjectsProvider></MembersProvider></AuthProvider>
    }
    const { result } = renderHook(() => ({ members: useMembers(), projects: useProjects() }), { wrapper: AccountWrapper })

    await act(async () => {
      await result.current.members.addMember?.({ name: 'عضو دارای نقش سراسری', email: 'legacy-role@karnex.local', jobTitle: '', roleId: 'pm', avatarId: null })
    })
    const member = result.current.members.members.find((item) => item.email === 'legacy-role@karnex.local')!
    let created: Awaited<ReturnType<NonNullable<typeof result.current.projects.createProject>>> | undefined
    await act(async () => {
      created = await result.current.projects.createProject?.({ key: 'ISOLATED', name: 'نقش ایزوله', description: '', type: 'scrum', status: 'active', privacy: 'private', icon: 'folder-kanban', color: '#3b82f6', progress: 0, members: [member.id], startDate: '', endDate: '', tasksCount: 0, completedTasks: 0 })
    })
    if (!created || !created.ok) throw new Error('Runtime project creation failed')
    expect(created.project.memberRoles).toEqual({})
    expect(getProjectMemberRole(created.project, member.id, member.roleId)).toBeUndefined()
    expect(result.current.projects.canManageProjectAccess(created.project.id)).toBe(false)
  })

  it('rejects project access mutations for a normal project member at the context boundary', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper: ({ children }) => <AccessWrapper userId="m2">{children}</AccessWrapper> })

    expect(result.current.canManageProjectAccess('p1')).toBe(false)
    await act(async () => {
      expect((await result.current.addProjectMember?.('p1', { memberId: 'm8' }))?.ok).toBe(false)
      expect((await result.current.updateProjectMemberAccess?.('p1', { memberId: 'm1', roleId: 'sm' }))?.ok).toBe(false)
      expect((await result.current.removeProjectMember?.('p1', 'm1'))?.ok).toBe(false)
    })
  })
})
