import { describe, expect, it } from 'vitest'
import type {
  CreateProjectResponse,
  ProjectAccessApiErrorCode,
  ProjectResponse,
  VersionedProjectMutation,
} from '@/types/projectAccessApi'

describe('Project/Access API contract', () => {
  it('requires the creation response to retain creator membership and the PM role', () => {
    const response: CreateProjectResponse = {
      ok: true,
      project: {
        id: 'project-1', key: 'PRJ', name: 'Project', description: '', type: 'scrum', status: 'active', privacy: 'private', icon: '', color: '', progress: 0,
        members: ['member-1'], memberRoles: { 'member-1': 'pm' }, startDate: '', endDate: '', tasksCount: 0, completedTasks: 0,
      },
      initialWorkflowAssignment: { projectId: 'project-1', defaultWorkflowId: 'workflow-default' },
      version: 'project-version-1',
    }

    expect(response.project.members).toContain('member-1')
    expect(response.project.memberRoles?.['member-1']).toBe('pm')
    expect(response.initialWorkflowAssignment.projectId).toBe(response.project.id)
  })

  it('requires the authoritative version for a stale mutation result', () => {
    const code: ProjectAccessApiErrorCode = 'version_mismatch'
    const response: ProjectResponse = { ok: false, code, currentVersion: 'v2' }

    expect(response).toMatchObject({ ok: false, code: 'version_mismatch', currentVersion: 'v2' })
  })

  it('requires an expected version for every existing-project mutation', () => {
    const request: VersionedProjectMutation<{ memberId: string }> = {
      input: { memberId: 'member-2' },
      expectedVersion: 'project-version-1',
    }

    expect(request.expectedVersion).toBe('project-version-1')
  })
})
