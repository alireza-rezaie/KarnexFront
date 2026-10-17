import { describe, expect, it } from 'vitest'
import type {
  AddWorkflowStatusInput,
  AssignPublishedWorkflowInput,
  BoardConfigurationResponse,
  CreateWorkflowDraftInput,
  MapBoardColumnStatusInput,
  PublishWorkflowInput,
  WorkflowBoardApiFailure,
  ProjectWorkflowAssignmentResponse,
} from '@/types/workflowBoardApi'

describe('workflow and board API contract', () => {
  it('requires a published workflow version when assigning a workflow to a project', () => {
    const assignment: AssignPublishedWorkflowInput = {
      idempotencyKey: 'workflow-assignment-1',
      projectId: 'project-a',
      workflowId: 'workflow-a',
      workflowVersionId: 'workflow-version-2',
      expectedAssignmentVersion: 'assignment-version-1',
    }

    expect(assignment.workflowVersionId).toBe('workflow-version-2')
    expect(assignment.expectedAssignmentVersion).toBe('assignment-version-1')
  })

  it('returns the current assignment version for a stale assignment', () => {
    const response: ProjectWorkflowAssignmentResponse = {
      ok: false,
      code: 'version_mismatch',
      currentAssignmentVersion: 'assignment-version-2',
    }

    expect(response.currentAssignmentVersion).toBe('assignment-version-2')
  })

  it('makes board mapping conditional on both board and active workflow versions', () => {
    const mapping: MapBoardColumnStatusInput = {
      projectId: 'project-a',
      columnId: 'column-final',
      statusId: 'release-x',
      workflowId: 'workflow-a',
      workflowVersionId: 'workflow-version-2',
      expectedBoardVersion: 'board-version-3',
    }
    const response: BoardConfigurationResponse = {
      ok: true,
      configuration: { projectId: 'project-a', columns: [], isCustomized: true, kanbanBacklogEnabled: true },
      boardVersion: 'board-version-4',
      activeWorkflow: { workflowId: 'workflow-a', workflowVersionId: 'workflow-version-2' },
      terminalStatusIds: ['release-x'],
    }

    expect(mapping.statusId).toBe(response.terminalStatusIds[0])
    expect(mapping.expectedBoardVersion).toBe('board-version-3')
    expect(response.boardVersion).toBe('board-version-4')
  })

  it('requires the authoritative Board version for a stale Board mutation', () => {
    const response: BoardConfigurationResponse = {
      ok: false,
      code: 'version_mismatch',
      currentBoardVersion: 'board-version-4',
    }

    expect(response.currentBoardVersion).toBe('board-version-4')
  })

  it('models stale mappings and duplicate mappings as explicit typed failures', () => {
    const stale: WorkflowBoardApiFailure = { ok: false, code: 'invalid_stale_status_mapping', currentBoardVersion: 'board-version-4' }
    const duplicate: WorkflowBoardApiFailure = { ok: false, code: 'duplicate_status_mapping' }

    expect(stale.code).toBe('invalid_stale_status_mapping')
    expect(duplicate.code).toBe('duplicate_status_mapping')
  })

  it('requires an owner project for every custom draft lifecycle mutation', () => {
    const draft: CreateWorkflowDraftInput = {
      idempotencyKey: 'workflow-draft-create-1',
      ownerProjectId: 'project-a',
      name: 'Release workflow',
    }
    const status: AddWorkflowStatusInput = {
      ownerProjectId: 'project-a',
      workflowId: 'workflow-draft-a',
      workflowVersionId: 'draft-version-1',
      expectedDraftVersion: 'draft-version-1',
      status: { name: 'Ready to release', color: '#22c55e' },
    }
    const publish: PublishWorkflowInput = {
      idempotencyKey: 'workflow-publish-1',
      ownerProjectId: 'project-a',
      workflowId: 'workflow-draft-a',
      workflowVersionId: 'draft-version-1',
      expectedDraftVersion: 'draft-version-1',
    }

    expect(draft.ownerProjectId).toBe(status.ownerProjectId)
    expect(status.ownerProjectId).toBe(publish.ownerProjectId)
  })
})
