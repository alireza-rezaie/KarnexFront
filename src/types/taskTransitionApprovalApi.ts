import type { ApprovalRequest, ApprovalVote } from '@/types/approvalRequest'
import type { CreateTaskInput, Task, TaskUpdates } from '@/types/task'
import type { WorkflowTransition } from '@/types/workflow'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, ApiVersionMismatch, IdempotentCommand } from '@/types/api'

/** Canonical transport failures for task, transition, and approval operations. */
export type TaskTransitionApprovalApiErrorCode = ApiErrorCode<
  | 'cross_project_reference'
  | 'invalid_source_status'
  | 'invalid_transition'
  | 'condition_failed'
  | 'validator_failed'
  | 'approval_required'
  | 'approval_rejected'
  | 'duplicate_approval_vote'
>

export type TaskTransitionApprovalApiFailure = ApiFailure<TaskTransitionApprovalApiErrorCode, {
  currentTaskVersion?: string
  currentWorkflowVersionId?: string
  currentApprovalRequest?: ApprovalRequest
  validationErrors?: string[]
  failedConditionRuleIds?: string[]
}>

export type TaskTransitionApprovalApiSuccess<T> = ApiSuccess<T>
export type TaskTransitionApprovalApiResult<T> = ApiResult<T, TaskTransitionApprovalApiErrorCode, {
  currentTaskVersion?: string
  currentWorkflowVersionId?: string
  currentApprovalRequest?: ApprovalRequest
  validationErrors?: string[]
  failedConditionRuleIds?: string[]
}>
export type TaskMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentTaskVersion'>
  | ApiFailure<Exclude<TaskTransitionApprovalApiErrorCode, 'version_mismatch'>, {
    currentWorkflowVersionId?: string
    currentApprovalRequest?: ApprovalRequest
    validationErrors?: string[]
    failedConditionRuleIds?: string[]
  }>

/** Server-authoritative approval state, including the concurrency token. */
export type AuthoritativeApprovalRequest = ApprovalRequest & {
  approvalVersion: string
}

export type ApprovalSnapshot = {
  approval: AuthoritativeApprovalRequest
  approvalVersion: string
}

/** Approval mutations expose a refreshable approval version when their request is stale. */
export type ApprovalMutationResponse<T> =
  | ApiSuccess<T>
  | ApiFailure<'version_mismatch', { currentApprovalVersion: string }>
  | ApiFailure<Exclude<TaskTransitionApprovalApiErrorCode, 'version_mismatch'>, {
    currentTaskVersion?: string
    currentWorkflowVersionId?: string
    currentApprovalRequest?: ApprovalRequest
    validationErrors?: string[]
    failedConditionRuleIds?: string[]
  }>

export type TaskVersionPrecondition = {
  taskId: string
  expectedTaskVersion: string
}

export type WorkflowVersionPrecondition = {
  workflowId: string
  workflowVersionId: string
}

export type TaskQuery = {
  projectId: string
  statusIds?: string[]
  assigneeId?: string
  sprintId?: string | null
  epicId?: string | null
  includeArchived?: boolean
  cursor?: string
  limit?: number
}

export type ListTasksResponse = TaskTransitionApprovalApiResult<{
  tasks: Task[]
  nextCursor?: string
}>

export type GetTaskResponse = TaskTransitionApprovalApiResult<{
  task: Task
  taskVersion: string
}>

/** The server resolves the initial status from the project's active published workflow. */
export type CreateTaskRequest = IdempotentCommand & {
  projectId: string
  workflowVersionId: string
  input: Omit<CreateTaskInput, 'status' | 'createdAt' | 'updatedAt' | 'comments' | 'attachments' | 'subtasks' | 'completedSubtasks'>
}

export type CreateTaskResponse = TaskTransitionApprovalApiResult<{
  task: Task
  taskVersion: string
}>

/** Uses TaskUpdates, which intentionally excludes id, projectId, and status. */
export type UpdateTaskRequest = TaskVersionPrecondition & {
  changes: TaskUpdates
}

export type UpdateTaskResponse = TaskMutationResponse<{
  task: Task
  taskVersion: string
}>

export type DeleteTaskRequest = TaskVersionPrecondition
export type DeleteTaskResponse = TaskMutationResponse<{ taskId: string }>

export type AvailableTransitionsRequest = {
  projectId: string
  taskId: string
  taskVersion?: string
  workflowVersionId: string
}

export type AvailableTransitionsResponse = TaskTransitionApprovalApiResult<{
  transitions: WorkflowTransition[]
  taskVersion: string
  workflowVersionId: string
}>

/** Transition calls are unsafe for optimistic application: conditions and approvals resolve atomically server-side. */
export type ExecuteTaskTransitionRequest = TaskVersionPrecondition & WorkflowVersionPrecondition & IdempotentCommand & {
  projectId: string
  transitionId: string
}

export type TaskTransitionAuditRecord = {
  id: string
  taskId: string
  projectId: string
  transitionId: string
  sourceStatusId: string
  targetStatusId: string
  actorId: string
  createdAt: string
}

export type ExecuteTaskTransitionResponse = TaskMutationResponse<{
  task: Task
  taskVersion: string
  transition: WorkflowTransition
  audit: TaskTransitionAuditRecord
  /** Present when the transition is held for approval rather than applied. */
  approvalRequest?: AuthoritativeApprovalRequest
}>

export type ListApprovalRequestsQuery = {
  projectId: string
  taskId?: string
  status?: ApprovalRequest['status']
  cursor?: string
  limit?: number
}

export type ListApprovalRequestsResponse = TaskTransitionApprovalApiResult<{
  requests: AuthoritativeApprovalRequest[]
  nextCursor?: string
}>

export type GetApprovalRequestResponse = TaskTransitionApprovalApiResult<ApprovalSnapshot>

export type CreateApprovalRequestInput = WorkflowVersionPrecondition & IdempotentCommand & {
  projectId: string
  taskId: string
  transitionId: string
  expectedTaskVersion: string
}

export type CreateApprovalRequestResponse = TaskMutationResponse<ApprovalSnapshot>

/** The API derives voter identity from the session and rejects a requester self-vote. */
export type CastApprovalVoteRequest = IdempotentCommand & {
  requestId: string
  expectedApprovalVersion: string
  action: ApprovalVote['action']
  reason?: string
}

/** Voting atomically writes the vote and recomputes quorum/rejection/request state. */
export type CastApprovalVoteResponse = ApprovalMutationResponse<{
  approval: AuthoritativeApprovalRequest
  approvalVersion: string
  vote: ApprovalVote
}>

/** Transport boundary only: a later API adapter implements these calls. */
export interface TaskTransitionApprovalApiContract {
  listTasks(query: TaskQuery): Promise<ListTasksResponse>
  getTask(taskId: string): Promise<GetTaskResponse>
  createTask(input: CreateTaskRequest): Promise<CreateTaskResponse>
  updateTask(input: UpdateTaskRequest): Promise<UpdateTaskResponse>
  deleteTask(input: DeleteTaskRequest): Promise<DeleteTaskResponse>
  getAvailableTransitions(input: AvailableTransitionsRequest): Promise<AvailableTransitionsResponse>
  executeTransition(input: ExecuteTaskTransitionRequest): Promise<ExecuteTaskTransitionResponse>
  listApprovalRequests(query: ListApprovalRequestsQuery): Promise<ListApprovalRequestsResponse>
  getApprovalRequest(requestId: string): Promise<GetApprovalRequestResponse>
  createApprovalRequest(input: CreateApprovalRequestInput): Promise<CreateApprovalRequestResponse>
  castApprovalVote(input: CastApprovalVoteRequest): Promise<CastApprovalVoteResponse>
}
