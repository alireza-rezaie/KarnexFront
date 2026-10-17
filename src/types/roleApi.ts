import type { CreateRoleInput, Permission, Role, RolePermissions, UpdateRoleInput } from '@/types/role'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, ApiVersionMismatch } from '@/types/api'

export type RoleApiErrorCode = ApiErrorCode<
  | 'protected_role'
  | 'role_in_use'
  | 'invalid_permission'
  | 'cross_project_reference'
>

export type RoleApiFailure = ApiFailure<RoleApiErrorCode, {
  currentRoleVersion?: string
  currentMatrixVersion?: string
}>

export type RoleApiSuccess<T> = ApiSuccess<T>
export type RoleApiResult<T> = ApiResult<T, RoleApiErrorCode, {
  currentRoleVersion?: string
  currentMatrixVersion?: string
}>
export type RoleMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentRoleVersion'>
  | ApiFailure<Exclude<RoleApiErrorCode, 'version_mismatch'>>
export type RoleMatrixMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentRoleVersion'>
  | ApiVersionMismatch<'currentMatrixVersion'>
  | ApiFailure<Exclude<RoleApiErrorCode, 'version_mismatch'>>

/** Project role records preserve existing Role fields and distinguish protected PM/SM roles. */
export type AuthoritativeProjectRole = Role & {
  projectId: string
  isSystem: boolean
  version: string
}

/** Stable backend IDs map the existing module/action permission definition matrix. */
export type PermissionDefinition = {
  id: string
  module: string
  action: string
}

export type RolePermissionMatrix = {
  projectId: string
  roleId: string
  permissionDefinitionVersion: string
  /** Only IDs returned in the matching definition version are valid. */
  grants: Record<string, boolean>
  version: string
  /** Compatibility projection for current UI consumers during integration. */
  legacyMatrix?: RolePermissions[string]
}

export type ListProjectRolesResponse = RoleApiResult<{
  roles: AuthoritativeProjectRole[]
}>

export type GetProjectRoleResponse = RoleApiResult<{
  role: AuthoritativeProjectRole
}>

export type CreateCustomRoleRequest = {
  projectId: string
  input: CreateRoleInput
}

export type CreateCustomRoleResponse = RoleApiResult<{
  role: AuthoritativeProjectRole
  matrix: RolePermissionMatrix
}>

export type UpdateCustomRoleRequest = {
  projectId: string
  roleId: string
  expectedRoleVersion: string
  changes: Omit<UpdateRoleInput, 'permissions'>
}

export type UpdateCustomRoleResponse = RoleMutationResponse<{
  role: AuthoritativeProjectRole
}>

export type RoleDeletionResolution =
  | { kind: 'reassign-members'; replacementRoleId: string }
  | { kind: 'remove-project-members'; memberIds: string[] }

/** Omit `resolution` to reject deletion when the role is still assigned. */
export type DeleteCustomRoleRequest = {
  projectId: string
  roleId: string
  expectedRoleVersion: string
  resolution?: RoleDeletionResolution
}

export type DeleteCustomRoleResponse = RoleMutationResponse<{
  roleId: string
  reassignedMemberIds?: string[]
  removedMemberIds?: string[]
}>

export type GetPermissionDefinitionsResponse = RoleApiResult<{
  /** Existing display grouping is preserved for UI migration. */
  legacyDefinitions: Permission[]
  definitions: PermissionDefinition[]
  version: string
}>

export type GetRolePermissionMatrixResponse = RoleApiResult<{
  matrix: RolePermissionMatrix
}>

export type UpdateRolePermissionMatrixRequest = {
  projectId: string
  roleId: string
  expectedRoleVersion: string
  expectedMatrixVersion: string
  permissionDefinitionVersion: string
  grants: Record<string, boolean>
}

export type UpdateRolePermissionMatrixResponse = RoleMatrixMutationResponse<{
  role: AuthoritativeProjectRole
  matrix: RolePermissionMatrix
}>

/**
 * All role and matrix writes require PM/SM membership in the target project; System
 * Admin has no independent project bypass. PM/SM IDs remain protected system IDs.
 * Project member role assignment is separate from this API and never falls back to a
 * global Member role.
 */
export interface RolesApiContract {
  listProjectRoles(projectId: string): Promise<ListProjectRolesResponse>
  getProjectRole(projectId: string, roleId: string): Promise<GetProjectRoleResponse>
  createCustomRole(input: CreateCustomRoleRequest): Promise<CreateCustomRoleResponse>
  updateCustomRole(input: UpdateCustomRoleRequest): Promise<UpdateCustomRoleResponse>
  deleteCustomRole(input: DeleteCustomRoleRequest): Promise<DeleteCustomRoleResponse>
  getPermissionDefinitions(): Promise<GetPermissionDefinitionsResponse>
  getRolePermissionMatrix(projectId: string, roleId: string): Promise<GetRolePermissionMatrixResponse>
  updateRolePermissionMatrix(input: UpdateRolePermissionMatrixRequest): Promise<UpdateRolePermissionMatrixResponse>
}
