import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { requestApi } from '@/services/authApi'
import { AuthContext } from '@/contexts/AuthContext'
import { MembersContext } from '@/contexts/MembersContext'
import { isProjectRoleManager } from '@/types/role'
import type {
  CreateProjectInput,
  Project,
  ProjectCreateCapabilities,
  ProjectDeleteCapabilities,
  ProjectAccessCapabilities,
  ProjectDisplayCopy,
  ProjectMutationResult,
  ProjectSettingsCapabilities,
  ProjectMemberAccessInput,
  ProjectVersion,
  ProjectVersionCapabilities,
  UpdateProjectInput,
} from '@/types/project'

export type {
  CreateProjectInput,
  ProjectCreateCapabilities,
  ProjectDeleteCapabilities,
  ProjectAccessCapabilities,
  ProjectMutationResult,
  ProjectSettingsCapabilities,
  ProjectMemberAccessInput,
  ProjectVersionCapabilities,
  UpdateProjectInput,
} from '@/types/project'

export type ProjectDeleteMutationResult = ProjectMutationResult

export type ProjectsContextValue = {
  projects: Project[]
  createServiceAvailable: boolean
  createLoading: boolean
  createError: string | null
  createCapabilities: ProjectCreateCapabilities
  displayCopy: ProjectDisplayCopy
  createProject?: (input: CreateProjectInput) => Promise<ProjectMutationResult>
  projectVersions: ProjectVersion[]
  versionServiceAvailable: boolean
  versionLoading: boolean
  versionError: string | null
  versionCapabilities: ProjectVersionCapabilities
  settingsServiceAvailable: boolean
  settingsLoading: boolean
  settingsError: string | null
  settingsCapabilities: ProjectSettingsCapabilities
  updateProject?: (projectId: string, updates: UpdateProjectInput) => Promise<ProjectMutationResult>
  deleteServiceAvailable: boolean
  deleteLoading: boolean
  deleteError: string | null
  deleteCapabilities: ProjectDeleteCapabilities
  deleteProject?: (projectId: string) => Promise<ProjectDeleteMutationResult>
  removeProjectsByIds: (projectIds: Project['id'][]) => Promise<ProjectDeleteMutationResult>
  accessCapabilities: ProjectAccessCapabilities
  canManageProjectAccess: (projectId: string | undefined) => boolean
  addProjectMember?: (projectId: string, input: ProjectMemberAccessInput) => Promise<ProjectMutationResult>
  updateProjectMemberAccess?: (projectId: string, input: ProjectMemberAccessInput) => Promise<ProjectMutationResult>
  removeProjectMember?: (projectId: string, memberId: string) => Promise<ProjectMutationResult>
}

// Exported for sibling runtime adapters that enforce project-scoped rules.
// eslint-disable-next-line react-refresh/only-export-components
export const ProjectsContext = createContext<ProjectsContextValue | undefined>(undefined)
const runtimeCreateCapabilities: ProjectCreateCapabilities = { canCreateProject: true }
const runtimeDeleteCapabilities: ProjectDeleteCapabilities = { canDeleteProject: true }
const runtimeSettingsCapabilities: ProjectSettingsCapabilities = { canUpdateProject: true }
const unavailableVersionCapabilities: ProjectVersionCapabilities = { canViewProjectVersions: false }
const runtimeAccessCapabilities: ProjectAccessCapabilities = { canManageProjectAccess: true }
const unavailableCopy: ProjectDisplayCopy = {
  createUnavailable: 'ساخت پروژه در نشست فعلی در دسترس نیست.',
  createLoading: 'در حال دریافت اطلاعات پروژه‌ها…',
}

type TestFixtures = { projects: Project[] }

// Test fixtures are injected only by the test runtime. Production always begins empty.
// eslint-disable-next-line react-refresh/only-export-components
export function getInitialProjects(mode = import.meta.env.MODE, fixtures = (globalThis as { __karnexTestFixtures?: TestFixtures }).__karnexTestFixtures): Project[] {
  return mode === 'test' ? [...(fixtures?.projects ?? [])] : []
}

function generateRuntimeProjectId(existingProjects: Project[]) {
  const existingIds = new Set(existingProjects.map((project) => project.id))
  let id = ''

  do {
    const uuid = globalThis.crypto?.randomUUID?.()
    id = uuid
      ? `runtime-${uuid}`
      : `runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  } while (existingIds.has(id))

  return id
}

function projectRoleMap(project: Project) {
  return project.memberRoles ?? {}
}

type BackendProjectMember = { userId: string; role: string }
type BackendProject = { id: number; key: string; name: string; description: string; type: Project['type']; status: Project['status']; privacy: Project['privacy']; icon: string; color: string; progress: number; startDate: string | null; endDate: string | null; tasksCount: number; completedTasks: number; members?: BackendProjectMember[] }
function fromBackendProject(project: BackendProject): Project {
  const members = project.members ?? []
  return {
    ...project,
    id: String(project.id),
    members: members.map((member) => member.userId),
    memberRoles: Object.fromEntries(members.map((member) => [member.userId, member.role])),
    startDate: project.startDate ?? '',
    endDate: project.endDate ?? '',
  }
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext)
  const membersContext = useContext(MembersContext)
  const members = useMemo(() => membersContext?.members ?? [], [membersContext])
  const hasMember = membersContext?.hasMember
  const projectsRef = useRef<Project[]>(getInitialProjects())
  const [projects, setProjects] = useState<Project[]>(() => getInitialProjects())
  const commitProjects = useCallback((update: Project[] | ((current: Project[]) => Project[])) => {
    const next = typeof update === 'function' ? update(projectsRef.current) : update
    projectsRef.current = next
    setProjects(next)
  }, [])
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return
    void requestApi<BackendProject[]>('/api/Projects')
      .then(async (items) => Promise.all(items.map(async (project) => requestApi<BackendProject>(`/api/Projects/${project.id}`))))
      .then((items) => commitProjects(items.map(fromBackendProject)))
      .catch(() => undefined)
  }, [commitProjects])
  const createProject = useCallback(async (input: CreateProjectInput): Promise<ProjectMutationResult> => {
    const creatorId = auth?.currentUserId
    const memberIds = [...new Set(creatorId && (hasMember?.(creatorId) ?? false) ? [...input.members, creatorId] : input.members)]
    const unknownMemberId = memberIds.find((memberId) => !(hasMember?.(memberId) ?? false))
    if (unknownMemberId) return { ok: false, message: 'عضو انتخاب‌شده در فهرست کاربران وجود ندارد.' }
    const memberRoles = {
      ...Object.fromEntries(Object.entries(input.memberRoles ?? {}).filter(([memberId]) => memberIds.includes(memberId))),
      ...(creatorId && memberIds.includes(creatorId) ? { [creatorId]: 'pm' } : {}),
    }
    // New runtime projects always carry an explicit project-role map.  Leaving
    // it undefined would activate the legacy global-member-role fallback.
    try {
      const created = await requestApi<BackendProject>('/api/Projects', { method: 'POST', body: JSON.stringify({ key: input.key, name: input.name, description: input.description, type: input.type, privacy: input.privacy, icon: input.icon, color: input.color, startDate: input.startDate || null, endDate: input.endDate || null }) })
      await Promise.all(memberIds.map((userId) => requestApi<BackendProjectMember>(`/api/Projects/${created.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId, role: memberRoles[userId] ?? 'member' }),
      })))
      const project = { ...fromBackendProject(created), members: memberIds, memberRoles }
      commitProjects((currentProjects) => [...currentProjects, project])
      return { ok: true, project }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : unavailableCopy.createUnavailable }
    }
  }, [auth, commitProjects, hasMember])
  // Mutations to an existing project are project-scoped.  In particular, a
  // system account is not implicitly a project manager and legacy directory
  // roles never authorize newly-created project records.
  const canMutateProject = useCallback((project: Project) => {
    // The current projects endpoint does not include membership data.  Until
    // that data is returned by the backend, an empty member list represents a
    // backend-owned project and authorization is enforced by its API.
    if (project.members.length === 0) return true
    const currentUserId = auth?.currentUserId
    if (!currentUserId || !project.members.includes(currentUserId)) return false
    return isProjectRoleManager(project.memberRoles?.[currentUserId])
  }, [auth])
  const updateProject = useCallback(async (projectId: string, updates: UpdateProjectInput): Promise<ProjectMutationResult> => {
    const existingProject = projectsRef.current.find((project) => project.id === projectId)
    if (!existingProject) return { ok: false, message: 'پروژه مورد نظر پیدا نشد.' }
    if (!canMutateProject(existingProject)) return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو این پروژه می‌تواند اطلاعات پروژه را تغییر دهد.' }

    try {
      const nextProject: Project = { ...existingProject, ...updates, id: existingProject.id }
      const updated = await requestApi<BackendProject>(`/api/Projects/${encodeURIComponent(projectId)}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: nextProject.name,
          description: nextProject.description,
          type: nextProject.type,
          status: nextProject.status,
          privacy: nextProject.privacy,
          icon: nextProject.icon,
          color: nextProject.color,
          startDate: nextProject.startDate || null,
          endDate: nextProject.endDate || null,
        }),
      })
      const project: Project = {
        ...fromBackendProject(updated),
        members: existingProject.members,
        memberRoles: existingProject.memberRoles,
      }
      commitProjects((currentProjects) => currentProjects.map((item) => item.id === projectId ? project : item))
      return { ok: true, project }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : unavailableCopy.createUnavailable }
    }
  }, [canMutateProject, commitProjects])
  const canManageProjectAccess = useCallback((projectId: string | undefined) => {
    if (!projectId) return false
    const project = projectsRef.current.find((item) => item.id === projectId)
    // Backend-owned projects are authorized by the API.  Empty membership
    // data may occur for a newly-created project before its member requests
    // have completed, so it must not lock the project settings UI.
    if (project?.members.length === 0) return true
    if (!auth?.currentUserId) return false
    return Boolean(project && project.members.includes(auth.currentUserId)
      && isProjectRoleManager(project.memberRoles?.[auth.currentUserId]))
  }, [auth])
  const rejectProjectAccessMutation = useCallback((projectId: string): ProjectMutationResult | undefined => (
    canManageProjectAccess(projectId) ? undefined : { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو این پروژه می‌تواند دسترسی‌ها را تغییر دهد.' }
  ), [canManageProjectAccess])
  const updateProjectMemberAccess = useCallback(async (projectId: string, input: ProjectMemberAccessInput): Promise<ProjectMutationResult> => {
    const unauthorized = rejectProjectAccessMutation(projectId)
    if (unauthorized) return unauthorized
    const project = projectsRef.current.find((item) => item.id === projectId)
    const member = members.find((item) => item.id === input.memberId)
    if (!project || !member || !project.members.includes(member.id)) return { ok: false, message: 'عضو به این پروژه دسترسی ندارد.' }
    try {
      const role = input.roleId ?? 'member'
      await requestApi<BackendProjectMember>(`/api/Projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(member.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      })
      const updatedProject = {
      ...project,
        memberRoles: { ...projectRoleMap(project), [member.id]: role },
      }
      commitProjects((current) => current.map((item) => item.id === projectId ? updatedProject : item))
      return { ok: true, project: updatedProject }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : unavailableCopy.createUnavailable }
    }
  }, [commitProjects, members, rejectProjectAccessMutation])
  const addProjectMember = useCallback(async (projectId: string, input: ProjectMemberAccessInput): Promise<ProjectMutationResult> => {
    const unauthorized = rejectProjectAccessMutation(projectId)
    if (unauthorized) return unauthorized
    const project = projectsRef.current.find((item) => item.id === projectId)
    const member = members.find((item) => item.id === input.memberId)
    if (!project || !member) return { ok: false, message: 'پروژه یا عضو مورد نظر پیدا نشد.' }
    if (project.members.includes(member.id)) return { ok: false, message: 'این عضو از قبل به پروژه دسترسی دارد.' }
    try {
      const role = input.roleId ?? 'member'
      await requestApi<BackendProjectMember>(`/api/Projects/${encodeURIComponent(projectId)}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: member.id, role }),
      })
      const updatedProject = {
      ...project,
      members: [...project.members, member.id],
        memberRoles: { ...projectRoleMap(project), [member.id]: role },
      }
      commitProjects((current) => current.map((item) => item.id === projectId ? updatedProject : item))
      return { ok: true, project: updatedProject }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : unavailableCopy.createUnavailable }
    }
  }, [commitProjects, members, rejectProjectAccessMutation])
  const removeProjectMember = useCallback(async (projectId: string, memberId: string): Promise<ProjectMutationResult> => {
    const unauthorized = rejectProjectAccessMutation(projectId)
    if (unauthorized) return unauthorized
    const project = projectsRef.current.find((item) => item.id === projectId)
    if (!project || !project.members.includes(memberId)) return { ok: false, message: 'عضو به این پروژه دسترسی ندارد.' }
    try {
      await requestApi<void>(`/api/Projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`, { method: 'DELETE' })
      const updatedProject = {
      ...project,
      members: project.members.filter((id) => id !== memberId),
      memberRoles: Object.fromEntries(Object.entries(projectRoleMap(project)).filter(([id]) => id !== memberId)),
      }
      commitProjects((current) => current.map((item) => item.id === projectId ? updatedProject : item))
      return { ok: true, project: updatedProject }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : unavailableCopy.createUnavailable }
    }
  }, [commitProjects, rejectProjectAccessMutation])
  const removeProjectsByIds = useCallback(async (projectIds: Project['id'][]): Promise<ProjectDeleteMutationResult> => {
    const ids = new Set(projectIds)
    const authoritativeProjects = projectsRef.current
    if (!ids.size || !authoritativeProjects.some((project) => ids.has(project.id))) return { ok: false, message: 'پروژه‌ای برای حذف پیدا نشد.' }
    const selectedProjects = authoritativeProjects.filter((project) => ids.has(project.id))
    if (selectedProjects.length !== ids.size) return { ok: false, message: 'پروژه‌ای برای حذف پیدا نشد.' }
    if (selectedProjects.some((project) => !canMutateProject(project))) {
      return { ok: false, message: 'فقط مدیر پروژه یا اسکرام‌مسترِ عضو هر پروژه می‌تواند آن را حذف کند.' }
    }
    try {
      await Promise.all(selectedProjects.map((project) => requestApi<void>(`/api/Projects/${encodeURIComponent(project.id)}`, { method: 'DELETE' })))
      const selected = selectedProjects[0]
      commitProjects((current) => current.filter((project) => !ids.has(project.id)))
      return { ok: true, project: selected }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : unavailableCopy.createUnavailable }
    }
  }, [canMutateProject, commitProjects])
  const deleteProject = useCallback(async (projectId: Project['id']): Promise<ProjectDeleteMutationResult> => (
    removeProjectsByIds([projectId])
  ), [removeProjectsByIds])

  const value = useMemo(
    (): ProjectsContextValue => ({
      projects,
      // This is a session-only frontend adapter, not backend persistence.
      createServiceAvailable: true,
      createLoading: false,
      createError: null,
      createCapabilities: runtimeCreateCapabilities,
      displayCopy: unavailableCopy,
      createProject,
      projectVersions: [],
      versionServiceAvailable: false,
      versionLoading: false,
      versionError: null,
      versionCapabilities: unavailableVersionCapabilities,
      settingsServiceAvailable: true,
      settingsLoading: false,
      settingsError: null,
      settingsCapabilities: runtimeSettingsCapabilities,
      updateProject,
      deleteServiceAvailable: true,
      deleteLoading: false,
      deleteError: null,
      deleteCapabilities: runtimeDeleteCapabilities,
      deleteProject,
      accessCapabilities: runtimeAccessCapabilities,
      canManageProjectAccess,
      addProjectMember,
      updateProjectMemberAccess,
      removeProjectMember,
      removeProjectsByIds,
    }),
    [addProjectMember, canManageProjectAccess, createProject, deleteProject, projects, removeProjectMember, removeProjectsByIds, updateProject, updateProjectMemberAccess],
  )

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjects() {
  const context = useContext(ProjectsContext)

  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider.')
  }

  return context
}
