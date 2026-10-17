export interface Role {
  id: string
  name: string
  description: string
}

/** Stable system keys used for project-scoped role administration. */
export const projectRoleIds = {
  projectManager: 'pm',
  scrumMaster: 'sm',
} as const

export const projectRoleLabels: Record<ProjectRoleId, string> = {
  [projectRoleIds.projectManager]: 'مدیر پروژه',
  [projectRoleIds.scrumMaster]: 'اسکرام‌مستر',
}

export type ProjectRoleId = (typeof projectRoleIds)[keyof typeof projectRoleIds]

export function isProjectRoleManager(roleId: string | undefined): roleId is ProjectRoleId {
  return roleId === projectRoleIds.projectManager || roleId === projectRoleIds.scrumMaster
}

export interface Permission {
  module: string
  perms: string[]
}

export type RolePermissions = Record<string, boolean[][]>

export type CreateRoleInput = Pick<Role, 'name' | 'description'>
export type UpdateRoleInput = Partial<Pick<Role, 'name' | 'description'>> & { permissions?: boolean[][] }

export type RoleMutationResult =
  | { ok: true; role?: Role }
  | { ok: false; message?: string }

export interface RoleCapabilities {
  canCreateRole: boolean
  canUpdateRole: boolean
  canDeleteRole: boolean
}

export interface RoleDisplayCopy {
  serviceUnavailable: string
  actionUnavailable: string
  loading: string
}
