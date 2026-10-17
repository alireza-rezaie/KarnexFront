import { describe, expect, it } from 'vitest'
import type { RegisterRequest } from '@/types/authMemberApi'
import type { ProjectListQuery, CreateProjectRequest } from '@/types/projectAccessApi'
import type { CreateTaskRequest, ExecuteTaskTransitionRequest } from '@/types/taskTransitionApprovalApi'
import type { CompleteSprintRequest } from '@/types/sprintApi'
import type { RequestReportExportInput } from '@/types/reportApi'

describe('durable command idempotency contract', () => {
  it('requires one request identity for retriable durable commands', () => {
    type DurableCommandKey =
      | RegisterRequest['idempotencyKey']
      | CreateProjectRequest['idempotencyKey']
      | CreateTaskRequest['idempotencyKey']
      | ExecuteTaskTransitionRequest['idempotencyKey']
      | CompleteSprintRequest['idempotencyKey']
      | RequestReportExportInput['idempotencyKey']
    const key: DurableCommandKey = 'command-identity-1'

    expect(key).toBe('command-identity-1')
  })

  it('keeps read queries free of command identity requirements', () => {
    const query: ProjectListQuery = { status: 'active' }

    expect(query.status).toBe('active')
  })
})
