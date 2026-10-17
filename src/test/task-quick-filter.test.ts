import { describe, expect, it } from 'vitest'
import { filterTasksByQuickFilter, parseQuickTaskFilter } from '@/utils/taskQuickFilter'

const projectId = 'project-a'
const today = 14030702
const terminalStatusIds = ['done']
const task = (overrides: Partial<{ id: string; projectId: string; assignee: string; reporter: string; dueDate?: string; status: string }> = {}) => ({
  id: 'task-1',
  projectId,
  assignee: 'member-1',
  reporter: 'member-1',
  dueDate: '1403/7/2',
  status: 'todo',
  ...overrides,
})

describe('task quick filters', () => {
  it('filters mine by member ID within the selected project', () => {
    const tasks = [task(), task({ id: 'task-2', assignee: 'member-2' }), task({ id: 'task-3', projectId: 'project-b' })]

    expect(filterTasksByQuickFilter(tasks, projectId, 'mine', 'member-1', today, terminalStatusIds).map((item) => item.id)).toEqual(['task-1'])
    expect(filterTasksByQuickFilter(tasks, projectId, 'mine', undefined, today, terminalStatusIds)).toEqual([])
  })

  it('matches only valid Jalali due dates for today', () => {
    const tasks = [task(), task({ id: 'yesterday', dueDate: '1403/7/1' }), task({ id: 'tomorrow', dueDate: '1403/7/3' }), task({ id: 'invalid', dueDate: 'invalid' }), task({ id: 'missing', dueDate: undefined })]

    expect(filterTasksByQuickFilter(tasks, projectId, 'due-today', 'member-1', today, terminalStatusIds).map((item) => item.id)).toEqual(['task-1'])
  })

  it('matches overdue unfinished tasks only', () => {
    const tasks = [task({ id: 'past-open', dueDate: '1403/7/1' }), task({ id: 'past-done', dueDate: '1403/7/1', status: 'done' }), task({ id: 'today' }), task({ id: 'future', dueDate: '1403/7/3' }), task({ id: 'invalid', dueDate: 'invalid' })]

    expect(filterTasksByQuickFilter(tasks, projectId, 'overdue', 'member-1', today, terminalStatusIds).map((item) => item.id)).toEqual(['past-open'])
  })

  it('filters created-by-me by reporter within the selected project', () => {
    const tasks = [
      task(),
      task({ id: 'another-reporter', reporter: 'member-2' }),
      task({ id: 'other-project', projectId: 'project-b' }),
    ]

    expect(filterTasksByQuickFilter(tasks, projectId, 'created-by-me', 'member-1', today, terminalStatusIds).map((item) => item.id)).toEqual(['task-1'])
    expect(filterTasksByQuickFilter(tasks, projectId, 'created-by-me', undefined, today, terminalStatusIds)).toEqual([])
  })

  it('filters completed tasks by the established done status within the selected project', () => {
    const tasks = [
      task({ id: 'done-task', status: 'done' }),
      task({ id: 'review-task', status: 'review' }),
      task({ id: 'other-project-done', projectId: 'project-b', status: 'done' }),
    ]

    expect(filterTasksByQuickFilter(tasks, projectId, 'completed', 'member-1', today, terminalStatusIds).map((item) => item.id)).toEqual(['done-task'])
  })

  it('uses the supplied project terminal IDs for completed and overdue task views', () => {
    const tasks = [
      task({ id: 'release', status: 'release-x', dueDate: '1403/7/1' }),
      task({ id: 'literal-done', status: 'done', dueDate: '1403/7/1' }),
      task({ id: 'other-project-release', projectId: 'project-b', status: 'release-x', dueDate: '1403/7/1' }),
    ]

    expect(filterTasksByQuickFilter(tasks, projectId, 'completed', 'member-1', today, ['release-x']).map((item) => item.id)).toEqual(['release'])
    expect(filterTasksByQuickFilter(tasks, projectId, 'overdue', 'member-1', today, ['release-x']).map((item) => item.id)).toEqual(['literal-done'])
    expect(filterTasksByQuickFilter(tasks, projectId, 'completed', 'member-1', today, []).map((item) => item.id)).toEqual([])
  })

  it('keeps normal project-scoped results for an invalid quick filter', () => {
    const tasks = [task(), task({ id: 'other-project', projectId: 'project-b' })]

    expect(parseQuickTaskFilter('garbage')).toBeUndefined()
    expect(filterTasksByQuickFilter(tasks, projectId, parseQuickTaskFilter('garbage'), 'member-1', today, terminalStatusIds).map((item) => item.id)).toEqual(['task-1'])
  })
})
