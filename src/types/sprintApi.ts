import type { CreateSprintInput, Sprint, SprintCompletionDestination } from '@/types/sprint'
import type { Task } from '@/types/task'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, ApiVersionMismatch, IdempotentCommand } from '@/types/api'

/** Canonical transport failures for project-scoped Scrum sprint operations. */
export type SprintApiErrorCode = ApiErrorCode<
  | 'non_scrum_project'
  | 'invalid_sprint_state'
  | 'invalid_destination'
  | 'cross_project_reference'
  | 'task_placement_conflict'
>

export type SprintApiFailure = ApiFailure<SprintApiErrorCode, {
  currentSprintVersion?: string
  currentTaskVersion?: string
}>

export type SprintApiSuccess<T> = ApiSuccess<T>
export type SprintApiResult<T> = ApiResult<T, SprintApiErrorCode, {
  currentSprintVersion?: string
  currentTaskVersion?: string
}>

/** Read snapshot of the Sprint and the task membership the lifecycle operates on. */
export type SprintSnapshot = {
  sprint: Sprint
  sprintVersion: string
  taskIds: string[]
}

/** Sprint lifecycle mutations must surface the authoritative version on stale state. */
export type SprintMutationResponse<T> =
  | ApiSuccess<T>
  | ApiFailure<'version_mismatch', { currentSprintVersion: string }>
  | ApiFailure<Exclude<SprintApiErrorCode, 'version_mismatch'>, {
    currentSprintVersion?: string
    currentTaskVersion?: string
  }>

export type SprintVersionPrecondition = {
  sprintId: string
  expectedSprintVersion: string
}

export type TaskPlacementVersionPrecondition = {
  taskId: string
  expectedTaskVersion: string
}

export type ListSprintsQuery = {
  projectId: string
  statuses?: Sprint['status'][]
  cursor?: string
  limit?: number
}

export type ListSprintsResponse = SprintApiResult<{
  sprints: Array<Sprint & { version: string }>
  nextCursor?: string
}>

export type GetSprintResponse = SprintApiResult<SprintSnapshot>

export type CreateSprintRequest = IdempotentCommand & {
  projectId: string
  input: CreateSprintInput
}

export type CreateSprintResponse = SprintApiResult<{
  sprint: Sprint
  sprintVersion: string
}>

/** Date range and duration retain the current canonical ISO/Gregorian contract. */
export type UpdateSprintRequest = SprintVersionPrecondition & {
  projectId: string
  changes: Partial<CreateSprintInput>
}

export type UpdateSprintResponse = SprintMutationResponse<{
  sprint: Sprint
  sprintVersion: string
}>

export type StartSprintRequest = SprintVersionPrecondition & {
  projectId: string
}

export type StartSprintResponse = SprintMutationResponse<{
  sprint: Sprint
  sprintVersion: string
}>

/** The client supplies only a destination—not a client-side completed/unfinished classification. */
export type CompleteSprintRequest = SprintVersionPrecondition & IdempotentCommand & {
  projectId: string
  destination: SprintCompletionDestination
}

export type SprintTaskPlacement = {
  task: Task
  taskVersion: string
}

/** Completion atomically resolves terminal tasks using board/workflow policy and moves unfinished work. */
export type CompleteSprintResponse = SprintMutationResponse<{
  sprint: Sprint
  sprintVersion: string
  completedTaskIds: string[]
  reassignedTasks: SprintTaskPlacement[]
}>

export type DeleteSprintRequest = SprintVersionPrecondition & {
  projectId: string
}

export type DeleteSprintResponse = SprintMutationResponse<{
  sprintId: string
  /** Version of the authoritative deletion/tombstone event. */
  sprintVersion: string
  affectedTasks: SprintTaskPlacement[]
}>

/** `destinationSprintId: null` represents Backlog. A future target must be version-checked. */
export type MoveTaskPlacementRequest = TaskPlacementVersionPrecondition & {
  projectId: string
} & (
  | { destinationSprintId: null }
  | { destinationSprintId: string; expectedDestinationSprintVersion: string }
)

export type MoveTaskPlacementResponse =
  | ApiSuccess<{
  task: Task
  taskVersion: string
  destinationSprint?: Sprint
  destinationSprintVersion?: string
  }>
  | ApiVersionMismatch<'currentTaskVersion'>
  | ApiVersionMismatch<'currentDestinationSprintVersion'>
  | ApiFailure<Exclude<SprintApiErrorCode, 'version_mismatch'>, {
    currentSprintVersion?: string
    currentTaskVersion?: string
  }>

/** Transport boundary only: a later backend adapter implements this project-scoped API. */
export interface SprintApiContract {
  listSprints(query: ListSprintsQuery): Promise<ListSprintsResponse>
  getSprint(sprintId: string): Promise<GetSprintResponse>
  createSprint(input: CreateSprintRequest): Promise<CreateSprintResponse>
  updateSprint(input: UpdateSprintRequest): Promise<UpdateSprintResponse>
  startSprint(input: StartSprintRequest): Promise<StartSprintResponse>
  completeSprint(input: CompleteSprintRequest): Promise<CompleteSprintResponse>
  deleteSprint(input: DeleteSprintRequest): Promise<DeleteSprintResponse>
  moveTaskPlacement(input: MoveTaskPlacementRequest): Promise<MoveTaskPlacementResponse>
}
