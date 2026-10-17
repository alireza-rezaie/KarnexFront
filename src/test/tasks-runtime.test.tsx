import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInitialTasks, TasksProvider, useTasks } from '@/contexts/TasksContext'
import type { CreateTaskInput, Task } from '@/types/task'

const input: CreateTaskInput = {
  key: 'RUNTIME-1', title: 'وظیفهٔ نشست', description: 'شرح واقعی', type: 'task', status: 'workflow-ready', priority: 'medium', assignee: '', reporter: '', labels: [], sprintId: undefined, storyPoints: undefined, estimatedSeconds: undefined, dueDate: undefined, createdAt: '1405/07/01', updatedAt: '1405/07/01', comments: 0, attachments: 0, subtasks: 0, completedSubtasks: 0,
}

type TestFixtures = { tasks: Task[] }
const fixtures = (globalThis as { __karnexTestFixtures?: TestFixtures }).__karnexTestFixtures
let previousTasks: Task[] | undefined

function ProviderWrapper({ children }: { children: ReactNode }) {
  return <TasksProvider>{children}</TasksProvider>
}

beforeEach(() => {
  previousTasks = fixtures?.tasks
  if (fixtures) fixtures.tasks = []
})

afterEach(() => {
  if (fixtures && previousTasks) fixtures.tasks = previousTasks
  vi.restoreAllMocks()
})

describe('frontend task runtime', () => {
  it('starts production with no tasks and never seeds demo tasks', () => {
    expect(getInitialTasks('production', { tasks: [input as Task] })).toEqual([])
  })

  it('creates and returns the authoritative runtime task in its requested project without localStorage', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useTasks(), { wrapper: ProviderWrapper })

    expect(result.current.tasks).toEqual([])
    let created: Awaited<ReturnType<typeof result.current.createTask>> | undefined
    await act(async () => { created = await result.current.createTask('project-runtime', input) })

    expect(created).toMatchObject({ ok: true, task: expect.objectContaining({ projectId: 'project-runtime', status: 'workflow-ready', assignee: '', sprintId: undefined }) })
    expect(created?.ok && created.task.id).toMatch(/^runtime-task-/)
    expect(result.current.tasks).toEqual([created?.ok ? created.task : undefined])
    expect(storage).not.toHaveBeenCalled()
  })
})
