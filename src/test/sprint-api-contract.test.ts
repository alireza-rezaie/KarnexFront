import { describe, expect, it } from 'vitest'
import type {
  CompleteSprintRequest,
  GetSprintResponse,
  MoveTaskPlacementRequest,
  SprintMutationResponse,
  SprintApiFailure,
} from '@/types/sprintApi'

describe('sprint API contract', () => {
  it('requires an explicit destination without accepting client completion classifications', () => {
    const complete: CompleteSprintRequest = {
      idempotencyKey: 'sprint-complete-1',
      projectId: 'project-a',
      sprintId: 'sprint-active',
      expectedSprintVersion: 'sprint-version-2',
      destination: { kind: 'future-sprint', sprintId: 'sprint-planned' },
    }

    expect(complete.destination).toEqual({ kind: 'future-sprint', sprintId: 'sprint-planned' })
  })

  it('makes task placement conflict-ready and models backlog explicitly', () => {
    const placement: MoveTaskPlacementRequest = {
      projectId: 'project-a',
      taskId: 'task-a',
      expectedTaskVersion: 'task-version-1',
      destinationSprintId: null,
    }

    expect(placement.destinationSprintId).toBeNull()
  })

  it('requires the target Sprint version when moving work into a future Sprint', () => {
    const placement: MoveTaskPlacementRequest = {
      projectId: 'project-a',
      taskId: 'task-a',
      expectedTaskVersion: 'task-version-1',
      destinationSprintId: 'sprint-planned',
      expectedDestinationSprintVersion: 'sprint-version-1',
    }

    expect(placement.expectedDestinationSprintVersion).toBe('sprint-version-1')
  })

  it('models a refreshable Sprint version mismatch and read snapshot version', () => {
    const stale: SprintMutationResponse<{ sprintVersion: string }> = {
      ok: false,
      code: 'version_mismatch',
      currentSprintVersion: 'sprint-version-3',
    }
    type ReadVersion = Extract<GetSprintResponse, { ok: true }>['sprintVersion']
    const version: ReadVersion = 'sprint-version-2'

    expect(stale.currentSprintVersion).toBe('sprint-version-3')
    expect(version).toBe('sprint-version-2')
  })

  it('uses explicit errors for non-Scrum and invalid destination attempts', () => {
    const nonScrum: SprintApiFailure = { ok: false, code: 'non_scrum_project' }
    const invalidDestination: SprintApiFailure = { ok: false, code: 'invalid_destination' }

    expect(nonScrum.code).toBe('non_scrum_project')
    expect(invalidDestination.code).toBe('invalid_destination')
  })
})
