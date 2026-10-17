import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { MembersProvider, useMembers } from '@/contexts/MembersContext'
import { ProjectsProvider, useProjects } from '@/contexts/ProjectsContext'

function RuntimeWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider><MembersProvider><ProjectsProvider>{children}</ProjectsProvider></MembersProvider></AuthProvider>
}

function useRuntime() {
  return { auth: useAuth(), members: useMembers(), projects: useProjects() }
}

const projectInput = (key: string, name: string, memberId: string) => ({
  key, name, description: '', type: 'scrum' as const, status: 'active' as const,
  privacy: 'private' as const, icon: 'folder-kanban', color: '#3b82f6', progress: 0,
  members: [memberId], memberRoles: { [memberId]: 'pm' }, startDate: '', endDate: '', tasksCount: 0, completedTasks: 0,
})

describe('project access runtime verification', () => {
  it('keeps two runtime users and their project memberships/roles isolated in one session', async () => {
    const { result } = renderHook(() => useRuntime(), { wrapper: RuntimeWrapper })
    const initialProjectCount = result.current.projects.projects.length
    await act(async () => {
      await result.current.auth.register?.({ firstName: 'کاربر', lastName: 'A', username: 'runtime-a', phone: '09120000001', email: 'a@local.test', password: 'Runtime!123' })
    })
    await waitFor(() => expect(result.current.auth.currentUserId).not.toBeNull())
    const userA = result.current.auth.currentUserId!

    await act(async () => {
      await result.current.auth.register?.({ firstName: 'کاربر', lastName: 'B', username: 'runtime-b', phone: '09120000002', email: 'b@local.test', password: 'Runtime!123' })
    })
    await waitFor(() => expect(result.current.auth.currentUserId).not.toBe(userA))
    const userB = result.current.auth.currentUserId!

    await act(async () => { await result.current.auth.login?.({ username: 'runtime-a', password: 'Runtime!123' }) })
    await waitFor(() => expect(result.current.auth.currentUserId).toBe(userA))
    let projectA: Awaited<ReturnType<NonNullable<typeof result.current.projects.createProject>>> | undefined
    let projectB: Awaited<ReturnType<NonNullable<typeof result.current.projects.createProject>>> | undefined
    await act(async () => { projectA = await result.current.projects.createProject!(projectInput('PA', 'Project A', userA)) })
    await waitFor(() => expect(result.current.projects.projects).toHaveLength(initialProjectCount + 1))
    await act(async () => { projectB = await result.current.projects.createProject!(projectInput('PB', 'Project B', userA)) })
    if (!projectA || !projectA.ok) throw new Error('Runtime project A creation failed')
    if (!projectB || !projectB.ok) throw new Error('Runtime project B creation failed')
    const projectAId = projectA.project.id
    const projectBId = projectB.project.id

    await act(async () => {
      expect((await result.current.projects.addProjectMember?.(projectAId, { memberId: userB, roleId: 'sm' }))?.ok).toBe(true)
      expect((await result.current.projects.addProjectMember?.(projectBId, { memberId: userB, roleId: 'dev' }))?.ok).toBe(true)
    })
    expect(result.current.projects.projects.find((item) => item.id === projectAId)?.memberRoles?.[userB]).toBe('sm')
    expect(result.current.projects.projects.find((item) => item.id === projectBId)?.memberRoles?.[userB]).toBe('dev')

    await act(async () => { expect((await result.current.projects.removeProjectMember?.(projectAId, userB))?.ok).toBe(true) })
    expect(result.current.members.members.some((member) => member.id === userB)).toBe(true)
    expect(result.current.projects.projects.find((item) => item.id === projectBId)?.members).toContain(userB)

    await act(async () => { await result.current.auth.login?.({ username: 'runtime-b', password: 'Runtime!123' }) })
    await waitFor(() => expect(result.current.auth.currentUserId).toBe(userB))
    expect(result.current.projects.canManageProjectAccess(projectBId)).toBe(false)
    await act(async () => expect((await result.current.projects.addProjectMember?.(projectBId, { memberId: userA }))?.ok).toBe(false))
  })
})
