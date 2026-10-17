import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ProjectBoardProvider, useProjectBoard, validateBoardMapping } from '@/contexts/ProjectBoardContext'
import type { Task } from '@/types/task'
import type { StatusDefinition } from '@/types/status'
import { selectBoardWork } from '@/utils/projectMethodology'

const statuses: StatusDefinition[] = [
  { id: 'todo', name: 'برای انجام', color: '#64748b' },
  { id: 'inprogress', name: 'در حال انجام', color: '#3b82f6' },
]

const task = (id: string, inKanbanBacklog = false): Task => ({
  id,
  key: id,
  title: id,
  description: '',
  type: 'task',
  status: 'todo',
  priority: 'medium',
  assignee: '',
  reporter: '',
  projectId: 'kanban-project',
  inKanbanBacklog,
  labels: [],
  createdAt: '',
  updatedAt: '',
  comments: 0,
  attachments: 0,
  subtasks: 0,
  completedSubtasks: 0,
})

function Wrapper({ children }: { children: ReactNode }) {
  return <ProjectBoardProvider>{children}</ProjectBoardProvider>
}

describe('Kanban runtime behavior', () => {
  it('flows tasks without a sprint and leaves only opted-in planning work off the enabled-backlog board', () => {
    const work = [task('flowing'), task('planning', true)]

    expect(selectBoardWork('continuous-flow', work, undefined, false).map((item) => item.id)).toEqual(['flowing', 'planning'])
    expect(selectBoardWork('continuous-flow', work, undefined, true).map((item) => item.id)).toEqual(['flowing'])
  })

  it('stores Kanban WIP limits and planning-area choice project-scoped in session memory', async () => {
    const { result } = renderHook(() => useProjectBoard(), { wrapper: Wrapper })
    const columns = result.current.resolveColumns('kanban-project', statuses)

    await act(async () => {
      expect(await result.current.updateBoardConfiguration('kanban-project', [{ ...columns[0]!, wipLimit: 1 }, columns[1]!], statuses)).toMatchObject({ ok: true })
      await result.current.setKanbanBacklogEnabled('kanban-project', false, statuses)
    })

    const configuration = result.current.getBoardConfiguration('kanban-project', statuses)
    expect(configuration.kanbanBacklogEnabled).toBe(false)
    expect(configuration.columns[0]?.wipLimit).toBe(1)
  })

  it('rejects invalid WIP values without imposing a workflow transition rule', () => {
    expect(validateBoardMapping([{ id: 'todo', name: 'برای انجام', order: 0, statusIds: ['todo'], wipLimit: 0 }], statuses)).toMatchObject({ valid: false })
    expect(validateBoardMapping([{ id: 'todo', name: 'برای انجام', order: 0, statusIds: ['todo'], wipLimit: 1 }], statuses)).toMatchObject({ valid: true })
  })
})
