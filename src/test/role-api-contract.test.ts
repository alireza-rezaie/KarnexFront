import { describe, expect, it } from 'vitest'
import type {
  DeleteCustomRoleRequest,
  RoleApiFailure,
  UpdateRolePermissionMatrixRequest,
} from '@/types/roleApi'

describe('roles and permissions API contract', () => {
  it('makes custom-role deletion resolve active project assignments explicitly', () => {
    const deletion: DeleteCustomRoleRequest = {
      projectId: 'project-a', roleId: 'role-custom', expectedRoleVersion: 'role-version-2',
      resolution: { kind: 'reassign-members', replacementRoleId: 'pm' },
    }

    expect(deletion.resolution?.kind).toBe('reassign-members')
  })

  it('binds matrix updates to role, matrix, and definition versions', () => {
    const update: UpdateRolePermissionMatrixRequest = {
      projectId: 'project-a', roleId: 'role-custom', expectedRoleVersion: 'role-version-2', expectedMatrixVersion: 'matrix-version-3', permissionDefinitionVersion: 'definitions-version-1', grants: { 'task:view': true },
    }

    expect(update.grants['task:view']).toBe(true)
  })

  it('represents protected, in-use, and stale permission cases explicitly', () => {
    const protectedRole: RoleApiFailure = { ok: false, code: 'protected_role' }
    const inUse: RoleApiFailure = { ok: false, code: 'role_in_use' }
    const invalidPermission: RoleApiFailure = { ok: false, code: 'invalid_permission' }

    expect([protectedRole.code, inUse.code, invalidPermission.code]).toEqual(['protected_role', 'role_in_use', 'invalid_permission'])
  })
})
