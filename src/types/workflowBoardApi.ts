import type { BoardColumn, ProjectBoardConfiguration } from '@/types/board'
import type { StatusDefinition } from '@/types/status'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, ApiVersionMismatch, IdempotentCommand } from '@/types/api'
import type {
  CloneWorkflowDefinitionInput,
  ProjectWorkflowAssignment,
  PublishedWorkflowVersion,
  WorkflowDefinition,
  WorkflowDraftPayload,
  WorkflowTransition,
} from '@/types/workflow'

/** Canonical transport errors for project-scoped workflow and board operations. */
export type WorkflowBoardApiErrorCode = ApiErrorCode<
  | 'invalid_workflow_state'
  | 'unpublished_workflow'
  | 'invalid_stale_status_mapping'
  | 'duplicate_status_mapping'
  | 'cross_project_reference'
>

export type WorkflowBoardApiFailure = ApiFailure<WorkflowBoardApiErrorCode, {
  currentWorkflowVersionId?: string
  currentBoardVersion?: string
  currentAssignmentVersion?: string
}>

export type WorkflowBoardApiSuccess<T> = ApiSuccess<T>
export type WorkflowBoardApiResult<T> = ApiResult<T, WorkflowBoardApiErrorCode, {
  currentWorkflowVersionId?: string
  currentBoardVersion?: string
  currentAssignmentVersion?: string
}>
export type WorkflowDraftMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentDraftVersion'>
  | ApiFailure<Exclude<WorkflowBoardApiErrorCode, 'version_mismatch'>, {
    currentWorkflowVersionId?: string
    currentBoardVersion?: string
    currentAssignmentVersion?: string
  }>

/** A published-version identity is required whenever a request relies on workflow statuses. */
export type WorkflowVersionPrecondition = {
  workflowId: string
  workflowVersionId: string
}

/**
 * Custom workflow drafts are owned by one project while they are edited and
 * published. A system workflow has no owner, but it cannot use draft mutation
 * operations. The API authorizes this scope through that project's PM/SM role.
 */
export type WorkflowDraftProjectScope = {
  ownerProjectId: string
}

/** The transport representation makes custom ownership explicit. */
export type ScopedWorkflowDefinition = WorkflowDefinition & {
  ownerProjectId: string | null
}

export type BoardVersionPrecondition = WorkflowVersionPrecondition & {
  /** Version of the board configuration on which this mutation was based. */
  expectedBoardVersion: string
}

export type ListWorkflowsQuery = {
  projectId?: string
  includeDrafts?: boolean
  cursor?: string
  limit?: number
}

export type ListWorkflowsResponse = WorkflowBoardApiResult<{
  workflows: ScopedWorkflowDefinition[]
  nextCursor?: string
}>

export type GetWorkflowResponse = WorkflowBoardApiResult<{
  workflow: ScopedWorkflowDefinition
  publishedVersion?: PublishedWorkflowVersion
}>

export type CreateWorkflowDraftInput = WorkflowDraftProjectScope & IdempotentCommand & {
  name: string
  description?: string
}

/** The source may be reusable, but the resulting draft belongs to this project. */
export type CloneWorkflowDraftInput = WorkflowVersionPrecondition & WorkflowDraftProjectScope & IdempotentCommand & {
  input: CloneWorkflowDefinitionInput
}

export type WorkflowDraftResponse = WorkflowBoardApiResult<{
  workflow: ScopedWorkflowDefinition
  draftVersion: string
}>

export type AddWorkflowStatusInput = WorkflowVersionPrecondition & WorkflowDraftProjectScope & {
  expectedDraftVersion: string
  status: Pick<StatusDefinition, 'name' | 'color'>
}

export type UpdateWorkflowStatusInput = WorkflowVersionPrecondition & WorkflowDraftProjectScope & {
  expectedDraftVersion: string
  statusId: string
  changes: Partial<Pick<StatusDefinition, 'name' | 'color'>>
}

export type DeleteWorkflowStatusInput = WorkflowVersionPrecondition & WorkflowDraftProjectScope & {
  expectedDraftVersion: string
  statusId: string
}

export type AddWorkflowTransitionInput = WorkflowVersionPrecondition & WorkflowDraftProjectScope & {
  expectedDraftVersion: string
  transition: Omit<WorkflowTransition, 'id'>
}

export type UpdateWorkflowTransitionInput = WorkflowVersionPrecondition & WorkflowDraftProjectScope & {
  expectedDraftVersion: string
  transitionId: string
  changes: Partial<Omit<WorkflowTransition, 'id'>>
}

export type DeleteWorkflowTransitionInput = WorkflowVersionPrecondition & WorkflowDraftProjectScope & {
  expectedDraftVersion: string
  transitionId: string
}

export type WorkflowDraftMutationResult = WorkflowDraftMutationResponse<{
  workflow: ScopedWorkflowDefinition
  draft: WorkflowDraftPayload
  draftVersion: string
}>

/** Publishing atomically validates and snapshots the complete draft. */
export type PublishWorkflowInput = WorkflowVersionPrecondition & WorkflowDraftProjectScope & IdempotentCommand & {
  expectedDraftVersion: string
}

export type PublishWorkflowResponse = WorkflowDraftMutationResponse<{
  workflow: ScopedWorkflowDefinition
  publishedVersion: PublishedWorkflowVersion
  workflowVersionId: string
}>

/** Only a published version can be assigned; assignment has its own concurrency version. */
export type AssignPublishedWorkflowInput = WorkflowVersionPrecondition & IdempotentCommand & {
  projectId: string
  expectedAssignmentVersion: string
}

export type ProjectWorkflowAssignmentSnapshot = {
  assignment: ProjectWorkflowAssignment
  assignmentVersion: string
  workflowVersionId: string
}

/** Read and mutation responses both expose the assignment's authoritative version. */
export type GetProjectWorkflowAssignmentResponse = WorkflowBoardApiResult<ProjectWorkflowAssignmentSnapshot>

/** A stale assignment has a specifically refreshable assignment version. */
export type ProjectWorkflowAssignmentResponse =
  | ApiSuccess<ProjectWorkflowAssignmentSnapshot>
  | ApiFailure<'version_mismatch', { currentAssignmentVersion: string }>
  | ApiFailure<Exclude<WorkflowBoardApiErrorCode, 'version_mismatch'>, {
    currentWorkflowVersionId?: string
    currentBoardVersion?: string
    currentAssignmentVersion?: string
  }>

export type GetBoardConfigurationResponse = WorkflowBoardApiResult<{
  configuration: ProjectBoardConfiguration
  boardVersion: string
  activeWorkflow: WorkflowVersionPrecondition
  /** Derived from the final effective column only; never inferred from a status label. */
  terminalStatusIds: string[]
}>

export type UpdateBoardConfigurationInput = BoardVersionPrecondition & {
  projectId: string
  columns: BoardColumn[]
}

/** A null status ID explicitly unmaps a column. */
export type MapBoardColumnStatusInput = BoardVersionPrecondition & {
  projectId: string
  columnId: string
  statusId: string | null
}

export type UpdateBoardColumnInput = BoardVersionPrecondition & {
  projectId: string
  columnId: string
  wipLimit: number | null
}

export type UpdateKanbanBacklogInput = BoardVersionPrecondition & {
  projectId: string
  enabled: boolean
}

export type BoardConfigurationSnapshot = {
  configuration: ProjectBoardConfiguration
  boardVersion: string
  activeWorkflow: WorkflowVersionPrecondition
  terminalStatusIds: string[]
}

/** A stale Board mutation must return the precise configuration version to refresh. */
export type BoardConfigurationResponse =
  | ApiSuccess<BoardConfigurationSnapshot>
  | ApiFailure<'version_mismatch', { currentBoardVersion: string }>
  | ApiFailure<Exclude<WorkflowBoardApiErrorCode, 'version_mismatch'>, {
    currentWorkflowVersionId?: string
    currentBoardVersion?: string
    currentAssignmentVersion?: string
  }>

/** Transport boundary only: implementations belong to a future API adapter. */
export interface WorkflowBoardApiContract {
  listWorkflows(query: ListWorkflowsQuery): Promise<ListWorkflowsResponse>
  getWorkflow(workflowId: string, workflowVersionId?: string): Promise<GetWorkflowResponse>
  createWorkflowDraft(input: CreateWorkflowDraftInput): Promise<WorkflowDraftResponse>
  cloneWorkflowToDraft(input: CloneWorkflowDraftInput): Promise<WorkflowDraftResponse>
  addStatus(input: AddWorkflowStatusInput): Promise<WorkflowDraftMutationResult>
  updateStatus(input: UpdateWorkflowStatusInput): Promise<WorkflowDraftMutationResult>
  deleteStatus(input: DeleteWorkflowStatusInput): Promise<WorkflowDraftMutationResult>
  addTransition(input: AddWorkflowTransitionInput): Promise<WorkflowDraftMutationResult>
  updateTransition(input: UpdateWorkflowTransitionInput): Promise<WorkflowDraftMutationResult>
  deleteTransition(input: DeleteWorkflowTransitionInput): Promise<WorkflowDraftMutationResult>
  publishWorkflow(input: PublishWorkflowInput): Promise<PublishWorkflowResponse>
  getProjectWorkflowAssignment(projectId: string): Promise<GetProjectWorkflowAssignmentResponse>
  assignPublishedWorkflow(input: AssignPublishedWorkflowInput): Promise<ProjectWorkflowAssignmentResponse>
  getBoardConfiguration(projectId: string): Promise<GetBoardConfigurationResponse>
  updateBoardConfiguration(input: UpdateBoardConfigurationInput): Promise<BoardConfigurationResponse>
  mapBoardColumnStatus(input: MapBoardColumnStatusInput): Promise<BoardConfigurationResponse>
  updateBoardColumn(input: UpdateBoardColumnInput): Promise<BoardConfigurationResponse>
  updateKanbanBacklog(input: UpdateKanbanBacklogInput): Promise<BoardConfigurationResponse>
}
