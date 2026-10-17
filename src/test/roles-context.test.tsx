import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { MembersProvider } from '@/contexts/MembersContext'
import { useMembers } from '@/contexts/MembersContext'
import { RolesProvider, useRoles } from '@/contexts/RolesContext'
import { ProjectsProvider } from '@/contexts/ProjectsContext'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'

function RolesWrapper({ children, userId = 'm1' }: { children: ReactNode; userId?: string }) {
  return <AuthenticatedTestProvider userId={userId}><MembersProvider><ProjectsProvider><RolesProvider>{children}</RolesProvider></ProjectsProvider></MembersProvider></AuthenticatedTestProvider>
}

describe('RolesContext', () => {
  it('allows a project manager to create and edit permissions in the current project', async () => {
    const { result } = renderHook(() => useRoles(), { wrapper: RolesWrapper })
    let roleId = ''

    await act(async () => {
      const created = await result.current.createRole?.('p1', { name: 'بازبین', description: 'بازبینی کیفیت' })
      expect(created?.ok).toBe(true)
      roleId = created?.ok ? (created.role?.id ?? '') : ''
    })
    await act(async () => {
      expect((await result.current.updateRole?.('p1', roleId, { permissions: result.current.permissions.map((permission) => permission.perms.map(() => true)) }))?.ok).toBe(true)
    })

    expect(result.current.rolePermissions[roleId]?.every((row) => row.every(Boolean))).toBe(true)
  })

  it('does not grant project-role authority from a global member role', async () => {
    function ScrumMasterHarness() {
      const members = useMembers()
      const roles = useRoles()
      return { members, roles }
    }
    const { result } = renderHook(() => ScrumMasterHarness(), { wrapper: ({ children }) => <RolesWrapper userId="m2">{children}</RolesWrapper> })

    expect(result.current.roles.canManageRoles('p1')).toBe(false)

    await act(async () => {
      expect((await result.current.members.updateMember?.('m2', { roleId: 'sm' }))?.ok).toBe(true)
    })
    // A directory role is not a project role. Access must be explicitly assigned
    // through Project Access for this project.
    expect(result.current.roles.canManageRoles('p1')).toBe(false)
    await act(async () => {
      expect((await result.current.roles.createRole?.('p1', { name: 'نقش اسکرام', description: '' }))?.ok).toBe(false)
      expect((await result.current.roles.createRole?.('p4', { name: 'نباید ساخته شود', description: '' }))?.ok).toBe(false)
    })
  })
  it('blocks duplicate role names after trimming and case normalization', async () => {
    const { result } = renderHook(() => useRoles(), { wrapper: RolesWrapper })

    await act(async () => {
      expect((await result.current.createRole?.('p1', { name: ' مدیر پروژه ', description: '' }))?.ok).toBe(false)
    })
  })

  it('blocks a role used by a member and deletes an unused role', async () => {
    const { result } = renderHook(() => useRoles(), { wrapper: RolesWrapper })

    await act(async () => {
      expect((await result.current.deleteRole?.('p1', 'pm'))?.ok).toBe(false)
      expect((await result.current.deleteRole?.('p1', 'viewer'))?.ok).toBe(true)
    })

    expect(result.current.roles.some((role) => role.id === 'viewer')).toBe(false)
    expect(result.current.rolePermissions.viewer).toBeUndefined()
  })

  it('preserves a role permission matrix while updating editable fields', async () => {
    const { result } = renderHook(() => useRoles(), { wrapper: RolesWrapper })
    const permissionsBefore = result.current.rolePermissions.dev

    await act(async () => {
      expect((await result.current.updateRole?.('p1', 'dev', { name: 'توسعه‌دهنده ارشد' }))?.ok).toBe(true)
    })

    expect(result.current.rolePermissions.dev).toBe(permissionsBefore)
    expect(result.current.roles.find((role) => role.id === 'dev')?.name).toBe('توسعه‌دهنده ارشد')
  })
})
