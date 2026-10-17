import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AuthContext } from '@/contexts/AuthContext'
import { ProjectsContext } from '@/contexts/ProjectsContext'
import {
  isProjectRoleManager,
  projectRoleIds,
  type CreateRoleInput,
  type Permission,
  type Role,
  type RoleCapabilities,
  type RoleDisplayCopy,
  type RoleMutationResult,
  type RolePermissions,
  type UpdateRoleInput,
} from '@/types/role'

export type { CreateRoleInput, RoleCapabilities, RoleDisplayCopy, RoleMutationResult, UpdateRoleInput } from '@/types/role'

// Static product metadata, not runtime role records.
// eslint-disable-next-line react-refresh/only-export-components
export const initialPermissions: Permission[] = [
  { module: 'پروژه', perms: ['مشاهده', 'ایجاد', 'ویرایش', 'حذف', 'مدیریت'] },
  { module: 'وظیفه', perms: ['مشاهده', 'ایجاد', 'ویرایش', 'حذف', 'مدیریت'] },
  { module: 'اسپرینت', perms: ['مشاهده', 'ایجاد', 'ویرایش', 'حذف', 'مدیریت'] },
  { module: 'گزارش', perms: ['مشاهده', 'ایجاد', 'ویرایش', 'حذف', 'مدیریت'] },
  { module: 'عضو', perms: ['مشاهده', 'ایجاد', 'ویرایش', 'حذف', 'مدیریت'] },
  { module: 'تنظیمات', perms: ['مشاهده', 'ایجاد', 'ویرایش', 'حذف', 'مدیریت'] },
]

// Test-only fixture matrices remain separate from production runtime state.
const testRolePermissions: RolePermissions = {
  admin: initialPermissions.map(() => [true, true, true, true, true]),
  pm: initialPermissions.map(() => [true, true, true, false, true]),
  dev: initialPermissions.map(() => [true, true, false, false, false]),
  viewer: initialPermissions.map(() => [true, false, false, false, false]),
}

export type RolesContextValue = {
  roles: Role[]
  permissions: Permission[]
  rolePermissions: RolePermissions
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  capabilities: RoleCapabilities
  displayCopy: RoleDisplayCopy
  canManageRoles: (projectId: string | undefined) => boolean
  createRole?: (projectId: string, input: CreateRoleInput) => Promise<RoleMutationResult>
  updateRole?: (projectId: string, roleId: Role['id'], updates: UpdateRoleInput) => Promise<RoleMutationResult>
  deleteRole?: (projectId: string, roleId: Role['id']) => Promise<RoleMutationResult>
}

// eslint-disable-next-line react-refresh/only-export-components
export const RolesContext = createContext<RolesContextValue | undefined>(undefined)
const isTestRuntime = import.meta.env.MODE === 'test'
const runtimeCapabilities: RoleCapabilities = { canCreateRole: true, canUpdateRole: true, canDeleteRole: true }
const runtimeCopy: RoleDisplayCopy = {
  serviceUnavailable: 'نقش‌ها در همین نشست مرورگر نگهداری می‌شوند.',
  actionUnavailable: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو این پروژه می‌تواند نقش‌ها را تغییر دهد.',
  loading: 'در حال ذخیره نقش‌ها…',
}

function emptyPermissionMatrix(permissions: Permission[]) {
  return permissions.map((permission) => permission.perms.map(() => false))
}

function validPermissionMatrix(value: boolean[][], permissions: Permission[]) {
  return value.length === permissions.length && value.every((row, index) => row.length === permissions[index]?.perms.length)
}

export function RolesProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext)
  const projectsContext = useContext(ProjectsContext)
  const [roleState, setRoleState] = useState<{ roles: Role[]; rolePermissions: RolePermissions }>(() => ({
    roles: isTestRuntime ? ((globalThis as { __karnexTestFixtures?: { roles: Role[] } }).__karnexTestFixtures?.roles ?? []) : [],
    rolePermissions: isTestRuntime ? testRolePermissions : {},
  }))
  const [permissions] = useState<Permission[]>(initialPermissions)

  const canManageRoles = useCallback((projectId: string | undefined) => {
    if (!projectId || !auth?.currentUserId || !projectsContext) return false
    const project = projectsContext.projects.find((item) => item.id === projectId)
    return Boolean(project && project.members.includes(auth.currentUserId)
      && isProjectRoleManager(project.memberRoles?.[auth.currentUserId]))
  }, [auth, projectsContext])

  const rejectUnauthorized = useCallback((projectId: string): RoleMutationResult | undefined => (
    canManageRoles(projectId) ? undefined : { ok: false, message: runtimeCopy.actionUnavailable }
  ), [canManageRoles])

  const createRole = useCallback(async (projectId: string, input: CreateRoleInput): Promise<RoleMutationResult> => {
    const unauthorized = rejectUnauthorized(projectId)
    if (unauthorized) return unauthorized
    const name = input.name.trim()
    if (!name || roleState.roles.some((role) => role.name.trim().toLocaleLowerCase('fa') === name.toLocaleLowerCase('fa'))) {
      return { ok: false, message: 'نام نقش تکراری است' }
    }
    const role: Role = { id: `role-${crypto.randomUUID()}`, name, description: input.description.trim() }
    setRoleState((current) => ({
      roles: [...current.roles, role],
      rolePermissions: { ...current.rolePermissions, [role.id]: emptyPermissionMatrix(permissions) },
    }))
    return { ok: true, role }
  }, [permissions, rejectUnauthorized, roleState.roles])

  const updateRole = useCallback(async (projectId: string, roleId: Role['id'], updates: UpdateRoleInput): Promise<RoleMutationResult> => {
    const unauthorized = rejectUnauthorized(projectId)
    if (unauthorized) return unauthorized
    const name = updates.name === undefined ? undefined : updates.name.trim()
    if (!roleState.roles.some((role) => role.id === roleId)
      || (name !== undefined && (!name || roleState.roles.some((role) => role.id !== roleId && role.name.trim().toLocaleLowerCase('fa') === name.toLocaleLowerCase('fa'))))) {
      return { ok: false, message: 'نام نقش تکراری است یا نقش در دسترس نیست' }
    }
    if (updates.permissions && !validPermissionMatrix(updates.permissions, permissions)) return { ok: false, message: 'ماتریس دسترسی نامعتبر است' }
    setRoleState((current) => ({
      roles: current.roles.map((role) => role.id === roleId
        ? { ...role, ...(name === undefined ? {} : { name }), ...(updates.description === undefined ? {} : { description: updates.description.trim() }) }
        : role),
      rolePermissions: updates.permissions
        ? { ...current.rolePermissions, [roleId]: updates.permissions.map((row) => [...row]) }
        : current.rolePermissions,
    }))
    return { ok: true }
  }, [permissions, rejectUnauthorized, roleState.roles])

  const deleteRole = useCallback(async (projectId: string, roleId: Role['id']): Promise<RoleMutationResult> => {
    const unauthorized = rejectUnauthorized(projectId)
    if (unauthorized) return unauthorized
    if (!roleState.roles.some((role) => role.id === roleId)) return { ok: false, message: 'نقش مورد نظر پیدا نشد' }
    if (roleId === projectRoleIds.projectManager || roleId === projectRoleIds.scrumMaster) return { ok: false, message: 'نقش سیستمی قابل حذف نیست' }
    if (projectsContext?.projects.some((project) => Object.values(project.memberRoles ?? {}).includes(roleId))) {
      return { ok: false, message: 'این نقش به یک دسترسی پروژه متصل است و قابل حذف نیست.' }
    }
    setRoleState((current) => ({
      roles: current.roles.filter((role) => role.id !== roleId),
      rolePermissions: Object.fromEntries(Object.entries(current.rolePermissions).filter(([id]) => id !== roleId)),
    }))
    return { ok: true }
  }, [projectsContext, rejectUnauthorized, roleState.roles])

  const value = useMemo<RolesContextValue>(() => ({
    roles: roleState.roles,
    permissions,
    rolePermissions: roleState.rolePermissions,
    serviceAvailable: true,
    loading: false,
    error: null,
    capabilities: runtimeCapabilities,
    displayCopy: runtimeCopy,
    canManageRoles,
    createRole,
    updateRole,
    deleteRole,
  }), [canManageRoles, createRole, deleteRole, permissions, roleState, updateRole])

  return <RolesContext.Provider value={value}>{children}</RolesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRoles() {
  const context = useContext(RolesContext)
  if (!context) throw new Error('useRoles must be used within a RolesProvider.')
  return context
}
