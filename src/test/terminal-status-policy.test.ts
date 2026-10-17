import { describe, expect, it } from 'vitest'
import type { ProjectBoardConfiguration } from '@/types/board'
import type { PublishedWorkflowVersion } from '@/types/workflow'
import { getTerminalStatusIds, isTaskCompleted } from '@/utils/terminalStatusPolicy'

const workflow = (projectStatusIds: string[]): PublishedWorkflowVersion => ({
  id: 'workflow-version', workflowId: 'workflow', version: 1, publishedAt: '', transitions: [],
  statuses: projectStatusIds.map((id) => ({ id, name: id, color: '#000000' })),
})

const board = (projectId: string, columns: ProjectBoardConfiguration['columns']): ProjectBoardConfiguration => ({
  projectId, columns, isCustomized: true, kanbanBacklogEnabled: false,
})

describe('terminal status policy', () => {
  it('resolves the built-in Done status from the final mapped Board column', () => {
    const configuration = board('project-a', [
      { id: 'todo-column', name: 'To Do', order: 0, statusIds: ['todo'] },
      { id: 'done-column', name: 'Done', order: 1, statusIds: ['done'] },
    ])
    expect(getTerminalStatusIds('project-a', configuration, workflow(['todo', 'done']))).toEqual(['done'])
  })

  it('supports arbitrary custom terminal status IDs', () => {
    const configuration = board('project-a', [
      { id: 'build', name: 'Build', order: 0, statusIds: ['build-x'] },
      { id: 'release', name: 'Release', order: 1, statusIds: ['release-x'] },
    ])
    expect(isTaskCompleted('project-a', { projectId: 'project-a', status: 'release-x' }, configuration, workflow(['build-x', 'release-x']))).toBe(true)
  })

  it('does not treat the literal done ID or non-final statuses as terminal', () => {
    const configuration = board('project-a', [
      { id: 'done-middle', name: 'Done', order: 0, statusIds: ['done'] },
      { id: 'release', name: 'Release', order: 1, statusIds: ['release-x'] },
    ])
    expect(isTaskCompleted('project-a', { projectId: 'project-a', status: 'done' }, configuration, workflow(['done', 'release-x']))).toBe(false)
    expect(isTaskCompleted('project-a', { projectId: 'project-a', status: 'release-x' }, configuration, workflow(['done', 'release-x']))).toBe(true)
  })

  it('ignores stale mappings and does not fabricate a fallback terminal status', () => {
    const configuration = board('project-a', [
      { id: 'todo', name: 'To Do', order: 0, statusIds: ['todo'] },
      { id: 'stale-final', name: 'Legacy', order: 1, statusIds: ['removed-status'] },
    ])
    expect(getTerminalStatusIds('project-a', configuration, workflow(['todo', 'done']))).toEqual([])
    expect(isTaskCompleted('project-a', { projectId: 'project-a', status: 'done' }, configuration, workflow(['todo', 'done']))).toBe(false)
  })

  it('keeps projects isolated', () => {
    const configuration = board('project-a', [{ id: 'release', name: 'Release', order: 0, statusIds: ['release-x'] }])
    const activeWorkflow = workflow(['release-x'])
    expect(getTerminalStatusIds('project-b', configuration, activeWorkflow)).toEqual([])
    expect(isTaskCompleted('project-b', { projectId: 'project-a', status: 'release-x' }, configuration, activeWorkflow)).toBe(false)
  })
})
