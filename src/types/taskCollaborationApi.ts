import type { TaskCollaborationScope, TaskComment, TaskTimeLog } from '@/types/taskCollaboration'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, ApiVersionMismatch, IdempotentCommand } from '@/types/api'

/** Canonical transport failures for comments and time logs. */
export type TaskCollaborationApiErrorCode = ApiErrorCode<
  | 'cross_project_task_reference'
>

export type TaskCollaborationApiFailure = ApiFailure<TaskCollaborationApiErrorCode, {
  currentVersion?: string
}>

export type TaskCollaborationApiSuccess<T> = ApiSuccess<T>
export type TaskCollaborationApiResult<T> = ApiResult<T, TaskCollaborationApiErrorCode, { currentVersion?: string }>
export type TaskCommentMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentCommentVersion'>
  | ApiFailure<Exclude<TaskCollaborationApiErrorCode, 'version_mismatch'>>
export type TaskTimeLogMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentTimeLogVersion'>
  | ApiFailure<Exclude<TaskCollaborationApiErrorCode, 'version_mismatch'>>

/** API responses carry server-authoritative identity and timestamps. */
export type AuthoritativeTaskComment = TaskComment & {
  version: string
}

export type AuthoritativeTaskTimeLog = TaskTimeLog & {
  createdAt: string
  updatedAt: string | null
  version: string
}

export type CollaborationListQuery = TaskCollaborationScope & {
  cursor?: string
  limit?: number
}

export type ListTaskCommentsResponse = TaskCollaborationApiResult<{
  comments: AuthoritativeTaskComment[]
  nextCursor?: string
}>

/** Author identity and timestamps are inferred by the backend, never supplied by the caller. */
export type CreateTaskCommentRequest = TaskCollaborationScope & IdempotentCommand & {
  body: string
}

export type CreateTaskCommentResponse = TaskCollaborationApiResult<{
  comment: AuthoritativeTaskComment
}>

export type UpdateTaskCommentRequest = TaskCollaborationScope & {
  commentId: string
  expectedVersion: string
  body: string
}

export type UpdateTaskCommentResponse = TaskCommentMutationResponse<{
  comment: AuthoritativeTaskComment
}>

export type DeleteTaskCommentRequest = TaskCollaborationScope & {
  commentId: string
  expectedVersion: string
}

export type DeleteTaskCommentResponse = TaskCommentMutationResponse<{
  commentId: string
}>

export type ListTaskTimeLogsResponse = TaskCollaborationApiResult<{
  timeLogs: AuthoritativeTaskTimeLog[]
  nextCursor?: string
}>

export type CreateTaskTimeLogRequest = TaskCollaborationScope & IdempotentCommand & {
  startedAt: string
  durationSeconds: number
  description?: string | null
}

export type CreateTaskTimeLogResponse = TaskCollaborationApiResult<{
  timeLog: AuthoritativeTaskTimeLog
}>

export type UpdateTaskTimeLogRequest = TaskCollaborationScope & {
  timeLogId: string
  expectedVersion: string
  changes: Partial<Pick<TaskTimeLog, 'startedAt' | 'durationSeconds' | 'description'>>
}

export type UpdateTaskTimeLogResponse = TaskTimeLogMutationResponse<{
  timeLog: AuthoritativeTaskTimeLog
}>

export type DeleteTaskTimeLogRequest = TaskCollaborationScope & {
  timeLogId: string
  expectedVersion: string
}

export type DeleteTaskTimeLogResponse = TaskTimeLogMutationResponse<{
  timeLogId: string
}>

/**
 * Project/task visibility is required for every method. Edit/delete authorization
 * is evaluated server-side as author or an explicit privileged project permission.
 * Creates may be optimistically displayed only with rollback on a failed response.
 */
export interface TaskCollaborationApiContract {
  listTaskComments(query: CollaborationListQuery): Promise<ListTaskCommentsResponse>
  createTaskComment(input: CreateTaskCommentRequest): Promise<CreateTaskCommentResponse>
  updateTaskComment(input: UpdateTaskCommentRequest): Promise<UpdateTaskCommentResponse>
  deleteTaskComment(input: DeleteTaskCommentRequest): Promise<DeleteTaskCommentResponse>
  listTaskTimeLogs(query: CollaborationListQuery): Promise<ListTaskTimeLogsResponse>
  createTaskTimeLog(input: CreateTaskTimeLogRequest): Promise<CreateTaskTimeLogResponse>
  updateTaskTimeLog(input: UpdateTaskTimeLogRequest): Promise<UpdateTaskTimeLogResponse>
  deleteTaskTimeLog(input: DeleteTaskTimeLogRequest): Promise<DeleteTaskTimeLogResponse>
}
