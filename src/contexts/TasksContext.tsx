import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { requestApi } from '@/services/authApi'
import { AuthContext } from '@/contexts/AuthContext'
import type { Project } from '@/types/project'
import { SprintsContext } from '@/contexts/SprintsContext'
import type { CreateTaskInput, Task, TaskCapabilities, TaskCreateMutationResult, TaskDisplayCopy, TaskMutationResult, TaskUpdates } from '@/types/task'

export type { CreateTaskInput, TaskCapabilities, TaskCreateMutationResult, TaskMutationResult, TaskUpdates } from '@/types/task'

export type TasksContextValue = {
  tasks: Task[]
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  capabilities: TaskCapabilities
  displayCopy: TaskDisplayCopy
  refreshTasks: () => Promise<void>
  createTask: (projectId: Project['id'], input: CreateTaskInput) => Promise<TaskCreateMutationResult>
  updateTask: (taskId: Task['id'], updates: TaskUpdates) => Promise<TaskMutationResult>
  /** Reserved for TaskTransitionContext after workflow policy evaluation. */
  applyTaskTransition: (taskId: Task['id'], status: Task['status']) => Promise<TaskMutationResult>
  removeTasksByIds: (taskIds: Task['id'][]) => Promise<TaskMutationResult>
}

const runtimeCapabilities: TaskCapabilities = {
  canCreateTask: true,
  canUpdateTask: true,
}
const testCapabilities: TaskCapabilities = {
  canCreateTask: true,
  canUpdateTask: true,
}

const unavailableCopy: TaskDisplayCopy = {
  serviceUnavailable: 'نیازمند اتصال سرویس وظایف',
  createUnavailable: 'برای ساخت وظیفه، پروژه و گردش‌کار فعال لازم است.',
  updateUnavailable: 'ویرایش وظیفه پس از اتصال API وظایف در دسترس خواهد بود.',
  loading: 'در حال دریافت اطلاعات وظایف…',
}

const TasksContext = createContext<TasksContextValue | undefined>(undefined)
type TestFixtures = { tasks: Task[] }
type BackendTask = { id: number; key: string; title: string; description: string; type: Task['type']; status: Task['status']; priority: Task['priority']; assigneeId: string | null; reporterId: string | null; projectId: number; sprintId: number | null; epicId: number | null; labels: string[]; storyPoints: number | null; dueDate: string | null; createdAt: string; updatedAt: string | null; comments: number; attachments: number; subtasks: number; completedSubtasks: number }
const fromBackendTask = (task: BackendTask): Task => ({ ...task, id: String(task.id), projectId: String(task.projectId), sprintId: task.sprintId === null ? undefined : String(task.sprintId), epicId: task.epicId === null ? undefined : String(task.epicId), assignee: task.assigneeId ?? '', reporter: task.reporterId ?? '', storyPoints: task.storyPoints ?? undefined, dueDate: task.dueDate ?? undefined, updatedAt: task.updatedAt ?? task.createdAt })
const taskPayload = (task: Omit<Task, 'id'> | Task, reporterId?: string | null) => ({ projectId: Number(task.projectId), title: task.title, description: task.description || null, type: task.type, priority: task.priority, assigneeId: task.assignee || null, reporterId: task.reporter || reporterId || null, sprintId: task.sprintId ? Number(task.sprintId) : null, parentId: task.epicId ? Number(task.epicId) : null, storyPoints: task.storyPoints ?? null, dueDate: task.dueDate || null, labels: task.labels.map((name) => ({ name, color: null })) })

// Test fixtures are injected only by the test runtime. Production always begins empty.
// eslint-disable-next-line react-refresh/only-export-components
export function getInitialTasks(mode = import.meta.env.MODE, fixtures = (globalThis as { __karnexTestFixtures?: TestFixtures }).__karnexTestFixtures): Task[] {
  return mode === 'test' ? [...(fixtures?.tasks ?? [])] : []
}

function generateRuntimeTaskId(existingTasks: Task[]) {
  const existingIds = new Set(existingTasks.map((task) => task.id))
  let id = ''
  do {
    const uuid = globalThis.crypto?.randomUUID?.()
    id = uuid
      ? `runtime-task-${uuid}`
      : `runtime-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  } while (existingIds.has(id))
  return id
}

export function TasksProvider({ children }: { children: ReactNode }) {
  // The frontend runtime begins empty and keeps only user-created tasks in memory.
  const isTestRuntime = import.meta.env.MODE === 'test'
  const [tasks, setTasks] = useState<Task[]>(() => getInitialTasks())
  const auth = useContext(AuthContext)
  const sprintsContext = useContext(SprintsContext)
  const sprints = sprintsContext?.sprints
  const refreshTasks = useCallback(async () => {
    if (isTestRuntime) return
    const items = await requestApi<BackendTask[]>('/api/tasks')
    setTasks(items.map(fromBackendTask))
  }, [isTestRuntime])
  useEffect(() => {
    if (isTestRuntime) return
    void refreshTasks().catch(() => undefined)
  }, [isTestRuntime, refreshTasks])
  useEffect(() => {
    if (!sprints) return
    const sprintIds = new Set(sprints.map((sprint) => sprint.id))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTasks((current) => current.map((task) => task.sprintId && !sprintIds.has(task.sprintId) ? { ...task, sprintId: undefined } : task))
  }, [sprints])
  useEffect(() => {
    if (!sprintsContext) return
    sprintsContext.registerSprintCompletionResolver((sprintId, destinationSprintId, terminalStatusIds) => {
      const terminalStatusIdSet = new Set(terminalStatusIds)
      setTasks((current) => current.map((task) => task.sprintId === sprintId && !terminalStatusIdSet.has(task.status)
        ? { ...task, sprintId: destinationSprintId }
        : task))
    })
    return () => sprintsContext.registerSprintCompletionResolver(null)
  }, [sprintsContext])
  const createRuntimeTask = useCallback(async (projectId: Project['id'], input: CreateTaskInput): Promise<TaskCreateMutationResult> => {
    if (isTestRuntime) { const task: Task = { ...input, id: generateRuntimeTaskId(tasks), projectId }; setTasks((current) => [...current, task]); return { ok: true, task } }
    try { const created = await requestApi<BackendTask>('/api/tasks', { method: 'POST', body: JSON.stringify(taskPayload({ ...input, projectId }, auth?.currentUserId)) }); const task = fromBackendTask(created); setTasks((current) => [...current, task]); return { ok: true, task } } catch (error) { return { ok: false, message: error instanceof Error ? error.message : unavailableCopy.createUnavailable } }
  }, [auth, isTestRuntime, tasks])
  const updateRuntimeTask = useCallback(async (taskId: Task['id'], updates: TaskUpdates): Promise<TaskMutationResult> => {
    if (!tasks.some((task) => task.id === taskId)) return { ok: false, message: unavailableCopy.updateUnavailable }
    if (Object.hasOwn(updates, 'status')) return { ok: false, message: 'تغییر وضعیت فقط از مسیر انتقال گردش‌کار مجاز است.' }
    if (isTestRuntime) { setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...updates } : task)); return { ok: true } }
    try { const updated = await requestApi<BackendTask>(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'PUT', body: JSON.stringify(taskPayload({ ...tasks.find((task) => task.id === taskId)!, ...updates }, auth?.currentUserId)) }); setTasks((current) => current.map((task) => task.id === taskId ? fromBackendTask(updated) : task)); return { ok: true } } catch (error) { return { ok: false, message: error instanceof Error ? error.message : unavailableCopy.updateUnavailable } }
  }, [auth, isTestRuntime, tasks])
  const applyTaskTransition = useCallback(async (taskId: Task['id'], status: Task['status']): Promise<TaskMutationResult> => {
    if (!tasks.some((task) => task.id === taskId)) return { ok: false, message: unavailableCopy.updateUnavailable }
    if (isTestRuntime) { setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status, updatedAt: new Date().toLocaleDateString('fa-IR') } : task)); return { ok: true } }
    try { const updated = await requestApi<BackendTask>(`/api/tasks/${encodeURIComponent(taskId)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setTasks((current) => current.map((task) => task.id === taskId ? fromBackendTask(updated) : task)); return { ok: true } } catch (error) { return { ok: false, message: error instanceof Error ? error.message : unavailableCopy.updateUnavailable } }
  }, [isTestRuntime, tasks])
  const removeTasksByIds = useCallback(async (taskIds: Task['id'][]): Promise<TaskMutationResult> => {
    const ids = new Set(taskIds)
    if (!ids.size || !tasks.some((task) => ids.has(task.id))) return { ok: false, message: 'وظیفه‌ای برای حذف پیدا نشد.' }
    if (isTestRuntime) { setTasks((current) => current.filter((task) => !ids.has(task.id))); return { ok: true } }
    try { await Promise.all([...ids].map((id) => requestApi<void>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }))); setTasks((current) => current.filter((task) => !ids.has(task.id))); return { ok: true } } catch (error) { return { ok: false, message: error instanceof Error ? error.message : unavailableCopy.updateUnavailable } }
  }, [isTestRuntime, tasks])
  const value = useMemo<TasksContextValue>(() => ({
    tasks,
    // This frontend adapter has no backend persistence.
    serviceAvailable: true,
    loading: false,
    error: null,
    capabilities: isTestRuntime ? testCapabilities : runtimeCapabilities,
    displayCopy: unavailableCopy,
    refreshTasks,
    createTask: createRuntimeTask,
    updateTask: updateRuntimeTask,
    applyTaskTransition,
    removeTasksByIds,
  }), [applyTaskTransition, createRuntimeTask, isTestRuntime, refreshTasks, removeTasksByIds, tasks, updateRuntimeTask])

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTasks() {
  const context = useContext(TasksContext)

  if (!context) {
    throw new Error('useTasks must be used within a TasksProvider.')
  }

  return context
}
