import { describe, expect, it } from 'vitest'
import type {
  CastApprovalVoteRequest,
  CastApprovalVoteResponse,
  ExecuteTaskTransitionRequest,
  GetApprovalRequestResponse,
  TaskTransitionApprovalApiFailure,
  UpdateTaskRequest,
} from '@/types/taskTransitionApprovalApi'

describe('task, transition, and approval API contract', () => {
  it('keeps generic updates versioned and status-free', () => {
    const update: UpdateTaskRequest = {
      taskId: 'task-a',
      expectedTaskVersion: 'task-version-2',
      changes: { title: 'عنوان جدید', dueDate: '2026-10-01' },
    }

    expect(update.changes.title).toBe('عنوان جدید')
  })

  it('requires current task and workflow versions before executing a transition', () => {
    const transition: ExecuteTaskTransitionRequest = {
      idempotencyKey: 'task-transition-1',
      projectId: 'project-a',
      taskId: 'task-a',
      expectedTaskVersion: 'task-version-2',
      workflowId: 'workflow-a',
      workflowVersionId: 'workflow-version-3',
      transitionId: 'transition-a',
    }

    expect(transition.workflowVersionId).toBe('workflow-version-3')
  })

  it('represents approval and workflow rejections with explicit transport codes', () => {
    const approval: TaskTransitionApprovalApiFailure = { ok: false, code: 'duplicate_approval_vote' }
    const validator: TaskTransitionApprovalApiFailure = { ok: false, code: 'validator_failed', validationErrors: ['estimate-required'] }

    expect(approval.code).toBe('duplicate_approval_vote')
    expect(validator.validationErrors).toEqual(['estimate-required'])
  })

  it('requires an approval version and returns it on an authoritative vote result', () => {
    const vote: CastApprovalVoteRequest = {
      idempotencyKey: 'approval-vote-1',
      requestId: 'approval-a',
      expectedApprovalVersion: 'approval-version-1',
      action: 'approve',
    }
    const stale: CastApprovalVoteResponse = {
      ok: false,
      code: 'version_mismatch',
      currentApprovalVersion: 'approval-version-2',
    }

    expect(vote.expectedApprovalVersion).toBe('approval-version-1')
    expect(stale.currentApprovalVersion).toBe('approval-version-2')
  })

  it('exposes the approval version in the authoritative approval read snapshot', () => {
    type ApprovalReadVersion = Extract<GetApprovalRequestResponse, { ok: true }>['approvalVersion']
    const version: ApprovalReadVersion = 'approval-version-3'

    expect(version).toBe('approval-version-3')
  })
})
