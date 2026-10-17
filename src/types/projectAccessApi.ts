import type { CreateProjectInput, Project, ProjectMemberAccessInput, UpdateProjectInput } from '@/types/project'
import type { ProjectWorkflowAssignment } from '@/types/workflow'
import type { ApiErrorCode, ApiFailure, ApiSuccess, IdempotentCommand } from '@/types/api'

/** Stable transport failures for project and project-access operations. */
export type ProjectAccessApiErrorCode = ApiErrorCode<
  | 'duplicate_membership'
  | 'invalid_role'
  | 'cross_project_reference'
>

export type ProjectAccessApiError =
  | ApiFailure<'version_mismatch', {
    /** The authoritative version lets the client refetch and resolve the conflict. */
    currentVersion: string
  }>
  | ApiFailure<Exclude<ProjectAccessApiErrorCode, 'version_mismatch'>>

export type ProjectAccessApiSuccess<T> = ApiSuccess<T>
export type ProjectAccessApiResult<T> = ProjectAccessApiSuccess<T> | ProjectAccessApiError

/** Every mutation of an existing project must state the version it was based on. */
export type VersionedProjectMutation<T> = {
  input: T
  expectedVersion: string
}

/** A project resource accompanied by its mandatory optimistic-concurrency token. */
export type VersionedProject = {
  project: Project
  version: string
}

export type ProjectListQuery = {
  status?: Project['status']
  type?: Project['type']
  memberId?: string
  cursor?: string
  limit?: number
}

export type ProjectListResponse = ProjectAccessApiResult<{ projects: VersionedProject[]; nextCursor?: string }>
export type ProjectResponse = ProjectAccessApiResult<VersionedProject>

/**
 * The authenticated creator is authoritative on the server. The success payload
 * confirms the atomic creation of project, creator membership/pm role and the
 * initial workflow assignment.
 */
export type CreateProjectResponse = ProjectAccessApiResult<{
  project: Project
  initialWorkflowAssignment: ProjectWorkflowAssignment
  version: string
}>

export type CreateProjectRequest = CreateProjectInput & IdempotentCommand

export type AddProjectMemberRequest = VersionedProjectMutation<ProjectMemberAccessInput>
export type ChangeProjectMemberRoleRequest = VersionedProjectMutation<{
  memberId: string
  roleId: string
}>
export type RemoveProjectMemberRequest = VersionedProjectMutation<{ memberId: string }>
export type ArchiveProjectRequest = VersionedProjectMutation<{ status: 'archived' }>
export type DeleteProjectRequest = VersionedProjectMutation<Record<never, never>>
export type DeleteProjectResponse = ProjectAccessApiResult<{
  projectId: string
  /** Version of the authoritative deletion/tombstone event. */
  version: string
}>

/**
 * Transport boundary only: roles are resolved from project.memberRoles and never
 * from a global Member.roleId. These operations never create Accounts or Members.
 */
export interface ProjectAccessApiContract {
  listProjects(query?: ProjectListQuery): Promise<ProjectListResponse>
  getProject(projectId: string): Promise<ProjectResponse>
  createProject(input: CreateProjectRequest): Promise<CreateProjectResponse>
  updateProject(projectId: string, request: VersionedProjectMutation<UpdateProjectInput>): Promise<ProjectResponse>
  archiveProject(projectId: string, request: ArchiveProjectRequest): Promise<ProjectResponse>
  deleteProject(projectId: string, request: DeleteProjectRequest): Promise<DeleteProjectResponse>
  addProjectMember(projectId: string, request: AddProjectMemberRequest): Promise<ProjectResponse>
  changeProjectMemberRole(projectId: string, request: ChangeProjectMemberRoleRequest): Promise<ProjectResponse>
  removeProjectMember(projectId: string, request: RemoveProjectMemberRequest): Promise<ProjectResponse>
}

/** Loading/error-ready state for future Context adapters; it changes no runtime behavior. */
export type ProjectAccessRequestState<T> = {
  data: T | null
  loading: boolean
  error: ProjectAccessApiError | null
}
