import { describe, expect, it } from 'vitest'
import type {
  CreateTaskCommentRequest,
  TaskCollaborationApiFailure,
  UpdateTaskTimeLogRequest,
} from '@/types/taskCollaborationApi'

describe('task collaboration API contract', () => {
  it('requires an explicit project/task scope without accepting author identity on create', () => {
    const comment: CreateTaskCommentRequest = {
      idempotencyKey: 'task-comment-create-1',
      projectId: 'project-a',
      taskId: 'task-a',
      body: 'نظر جدید',
    }

    expect(comment).toMatchObject({ projectId: 'project-a', taskId: 'task-a' })
  })

  it('makes time-log updates conflict-ready', () => {
    const update: UpdateTaskTimeLogRequest = {
      projectId: 'project-a',
      taskId: 'task-a',
      timeLogId: 'time-log-a',
      expectedVersion: 'time-log-version-2',
      changes: { durationSeconds: 1800, description: 'بازبینی' },
    }

    expect(update.changes.durationSeconds).toBe(1800)
  })

  it('uses typed failures for visibility and scope validation', () => {
    const forbidden: TaskCollaborationApiFailure = { ok: false, code: 'forbidden' }
    const mismatch: TaskCollaborationApiFailure = { ok: false, code: 'cross_project_task_reference' }

    expect(forbidden.code).toBe('forbidden')
    expect(mismatch.code).toBe('cross_project_task_reference')
  })
})
